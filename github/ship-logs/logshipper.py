import argparse
import dataclasses
import io
import operator as op
import os
import re
import sys
from collections import ChainMap, defaultdict
from datetime import date, datetime
from io import StringIO
from itertools import chain, groupby
from typing import Optional

import opensearchpy
import opensearchpy.helpers
from dateutil.parser import isoparse
from requests import Session
from requests.structures import CaseInsensitiveDict

API_BASE = "https://api.github.com"
ENVVARPREFIX = os.environ.get("ENVVARPREFIX", "")


def main() -> None:
    parser = build_cli_parser()

    try:
        args = parser.parse_args()

        env = ChainMap(os.environ, vars(args))

        log_fetch_config = create_config_from_dict(
            LogFetchConfig,
            env,
            prefix=f"{ENVVARPREFIX}GITHUB_",
        )

        validate_config(log_fetch_config)

        log_index_config = create_config_from_dict(
            LogIndexConfig,
            env,
            prefix=f"{ENVVARPREFIX}OPENSEARCH_",
        )
        validate_config(log_index_config)
        log_index_config.index = f"{log_index_config.index}-{date.today().isoformat()}"

        SESSION = Session()
        SESSION.headers.update({"Authorization": f"token {log_fetch_config.token}"})
        print(
            f"Getting all job information for {log_fetch_config.org}/{log_fetch_config.repository} Run #{log_fetch_config.run_id}"
        )

        run_metadata = get_run_metadata(SESSION, log_fetch_config)
        jobs_url = run_metadata["jobs_url"]

        jobs = get_jobs(SESSION, jobs_url)

        log_processor = process_logs_with(
            attach_index(log_index_config.index),
            attach_timestamp_to_log_record,
            attach_run_metadata(run_metadata, log_fetch_config),
            attach_job(jobs),
            attach_step(jobs),
        )

        log_entries = get_all_job_log_entries(
            SESSION, log_fetch_config, jobs, log_processor
        )

        log_index = opensearchpy.OpenSearch(
            [log_index_config.host],
            http_auth=(log_index_config.user, log_index_config.password),
        )

        for job_id, job_logs in log_entries.items():
            job_name = jobs[job_id]["job_name"]
            print(f"Shipping {job_name} logs to {log_index_config.index}")

            try:
                opensearchpy.helpers.bulk(
                    client=log_index,
                    actions=job_logs,
                )
            except Exception as e:
                print(f"::error::Failed to ship some logs for {job_name}: {e}")
    except KeyboardInterrupt:
        print("::notice::Log shipping requested to stop early")
        sys.exit(1)
    except MissingArguments as e:
        print(f"::error::{e}")
        parser.print_help()
        sys.exit(2)
    else:
        print("All done shipping logs")


def get_run_metadata(session: Session, log_fetch_config: "LogFetchConfig") -> str:
    METADATA_URL = f"{API_BASE}/repos/{log_fetch_config.org}/{log_fetch_config.repository}/actions/runs/{log_fetch_config.run_id}"

    r = session.get(METADATA_URL, stream=True)

    r.raise_for_status()
    return r.json()


def get_jobs(session: Session, jobs_url: str) -> dict[str, dict[str, str]]:
    jobs = {}
    jobs_response = session.get(jobs_url, params={"per_page": 100})
    jobs_response.raise_for_status()
    raw_jobs = jobs_response.json()
    for job in raw_jobs["jobs"]:
        # we should be the last in the workflow, but just in case
        if job["status"] != "completed":
            print(f"{job['name']} is not complete yet, not retrieving logs...")
            continue

        job_id = job["id"]
        jobs[job_id] = {
            "job_id": job_id,
            "job_name": job["name"],
            "job_status": job["status"],
            "job_conclusion": job["conclusion"],
            "job_steps": job["steps"],
        }
    return jobs


def get_all_job_log_entries(session, log_fetch_config, jobs, log_processor=None):
    if log_processor is None:
        log_processor = lambda l: l

    log_entries = defaultdict(list)

    for job_id, job in jobs.items():
        job_logs_url = f"{API_BASE}/repos/{log_fetch_config.org}/{log_fetch_config.repository}/actions/jobs/{job_id}/logs"
        r = session.get(job_logs_url, stream=True)
        print(f"Downloading logs for {job['job_name']}")
        if not r.ok:
            print(
                f"::error::Failed to download logs from {job['job_name']}, continuing"
            )
            continue

        log_entries[job_id] = join_multiline_logs(
            [
                log_processor(
                    {
                        "@msg": log,
                        "job_id": job_id,
                        "job_name": jobs[job_id]["job_name"],
                        "repo": log_fetch_config.repository,
                        "run_id": log_fetch_config.run_id,
                    }
                )
                for log in decode_logs(r.content)
            ]
        )

    return log_entries


def join_multiline_logs(job_logs):
    new_log_entries = []
    logs_by_step = groupby(sorted(job_logs, key=by_step_name), by_step_name)
    for step, logs in logs_by_step:
        logs = filter(composite(with_timestamp, non_empty), logs)
        logs = sorted(logs, key=by_timestamp)

        our_logs = []
        for hlw, g in groupby(logs, has_leading_whitespace):
            if not hlw:
                our_logs.extend(g)
                continue

            last_log = ""
            if not our_logs:
                # first line has leading whitespace
                last_log = next(g)
            else:
                last_log = our_logs[-1]

            log_lines = [last_log["@msg"]] + [l["@msg"] for l in g]

            last_log["@msg"] = str.join("\n", log_lines)

        new_log_entries.append(our_logs)

    return sorted(chain.from_iterable(new_log_entries), key=by_timestamp)


# remove ascii control characters
ansi_escape = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")


def decode_logs(raw_logs):
    for l in io.BytesIO(raw_logs):
        l = ansi_escape.sub("", l.strip().decode())

        if str.isspace(l):
            continue

        yield l


def attach_run_metadata(run_metadata, log_fetch_config):
    def attach(log):
        log.update(
            {
                "github": {
                    "repo": log_fetch_config.repository,
                    "id": log_fetch_config.run_id,
                    "org": log_fetch_config.org,
                },
                "run": {
                    "attempt": run_metadata["run_attempt"],
                },
                "workflow": {
                    "name": run_metadata.get("name"),
                    "trigger": run_metadata.get("event"),
                    "branch": run_metadata.get("head_branch"),
                    "sha": run_metadata.get("head_sha"),
                    "status": run_metadata.get("status"),
                    "conclusion": run_metadata.get("conclusion"),
                },
                "pull_request_url": run_metadata.get("pull_requests")[0].get("url") if run_metadata.get("pull_requests") else None,
                "pull_request_number": run_metadata.get("pull_requests")[0].get("number") if run_metadata.get("pull_requests") else None,
            }
        )

    return attach


def attach_job(job_metadata):
    def attach(log):
        log_job = job_metadata[log["job_id"]].copy()
        log_job.pop("job_steps", None)
        log["job"] = log_job

    return attach


def extract_timestamp(raw_msg: str) -> Optional["TimestampedLog"]:
    try:
        raw_ts, msg = raw_msg.split(" ", maxsplit=1)
        return TimestampedLog(isoparse(raw_ts).replace(microsecond=0), msg)
    except Exception:
        return None


def attach_timestamp_to_log_record(log):
    if ts := extract_timestamp(log["@msg"]):
        log["@msg"] = ts.msg
        log["@timestamp"] = ts.timestamp.isoformat()


def attach_index(index_name):
    def attach(log):
        log["_index"] = index_name

    return attach


# force hash method to be generated
@dataclasses.dataclass(eq=True, order=True, unsafe_hash=True)
class _StepRunTimes:
    start: datetime
    end: datetime

    def __contains__(self, other) -> bool:
        return self.start <= other <= self.end

    @staticmethod
    def try_parse(step) -> Optional["_StepRunTimes"]:
        try:
            return _StepRunTimes(
                start=isoparse(step["started_at"]),
                end=isoparse(step["completed_at"]),
            )
        except Exception:
            return None


def attach_step(jobs):
    job_steps = {}
    for job_id, job in jobs.items():
        steps = {}
        for step in job["job_steps"]:
            if runtimes := _StepRunTimes.try_parse(step):
                steps[runtimes] = step
        job_steps[job_id] = steps

    def attach(log):
        if not (timestamp := log.get("@timestamp")):
            return

        steps = job_steps[log["job_id"]]

        for runtime, step_data in steps.items():
            if isoparse(timestamp) in runtime:
                log["step"] = step_data
                break

    return attach


def process_logs_with(*processors):
    def log_processor(log):
        try:
            for p in processors:
                p(log)
        except Exception as e:
            print(
                f"::error::Failed to process {log['@msg']}: {str(e)}\nEnding processing of record"
            )
            raise
        return log

    return log_processor


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        epilog=f"The environment variables '{ENVVARPREFIX}OPENSEARCH_PASSWORD' and '{ENVVARPREFIX}GITHUB_TOKEN' must also be set in order for logs to be retrieved and shipped"
    )
    parser.add_argument(
        "--host",
        dest=f"{ENVVARPREFIX}OPENSEARCH_HOST",
        help=f"HOST:PORT for the opensearch server, default is localhost:9200. This can be set via the envvar '{ENVVARPREFIX}OPENSEARCH_HOST'",
        default="localhost:9200",
        metavar="HOST:PORT",
    )
    parser.add_argument(
        "--user",
        dest=f"{ENVVARPREFIX}OPENSEARCH_USER",
        help=f"Username to access the opensearch server with. This can be set via the envvar '{ENVVARPREFIX}OPENSEARCH_USER'",
        metavar="USER",
    )
    parser.add_argument(
        "--index",
        dest=f"{ENVVARPREFIX}OPENSEARCH_INDEX",
        help=f"Index to write logs to, will be suffixed with '-$TODAY'. This can be set via the envvar '{ENVVARPREFIX}OPENSEARCH_INDEX'",
        metavar="INDEX",
    )

    parser.add_argument(
        "--repository",
        dest=f"{ENVVARPREFIX}GITHUB_REPOSITORY",
        help=f"Github repository to read logs from. This can be set via the envvar '{ENVVARPREFIX}GITHUB_REPOSITORY'",
        metavar="REPOSITORY",
    )

    parser.add_argument(
        "--run-id",
        dest=f"{ENVVARPREFIX}GITHUB_RUN_ID",
        help=f"Run ID to pull logs from. This can be set via the envvar '{ENVVARPREFIX}GITHUB_RUN_ID'",
        metavar="RUNID",
    )
    parser.add_argument(
        "--org",
        dest=f"{ENVVARPREFIX}GITHUB_ORG",
        help=f"Organization the repository belongs to. This can be set via the envvar '{ENVVARPREFIX}GITHUB_ORG'",
        metavar="ORG",
    )

    return parser


class MissingArguments(Exception):
    pass


@dataclasses.dataclass
class TimestampedLog:
    timestamp: datetime
    msg: str


@dataclasses.dataclass
class LogIndexConfig:
    host: str
    index: str
    user: str
    password: str


@dataclasses.dataclass
class LogFetchConfig:
    repository: str
    run_id: str
    org: str
    token: str


def validate_config(config):
    missings = [k for k, v in dataclasses.asdict(config).items() if v is None]

    if missings:
        raise MissingArguments(f"Missing values for {str.join(' ', missings)}")


def filter_env(env, prefix):
    matched = {}
    for k, v in env.items():
        if str.startswith(k, prefix):
            matched[k.removeprefix(prefix)] = v
    return matched


def create_config_from_dict(config_type, env, prefix=None):
    if prefix:
        env = filter_env(env, prefix)

    env = CaseInsensitiveDict(env)
    fields = [f.name for f in dataclasses.fields(config_type)]
    values = {f: env.get(f) for f in fields}
    return config_type(**values)


composite = lambda *fs: lambda x: all(f(x) for f in fs)
has_leading_whitespace = lambda x: x["@msg"][0].isspace()
by_timestamp = op.itemgetter("@timestamp")
# log records without a timestamp field are actually empty
with_timestamp = lambda l: "@timestamp" in l
# some log records are also just empty too
non_empty = lambda x: len(x["@msg"]) > 0


def by_step_name(log_record) -> str:
    # need to return "-" instead of None because None is not orderable to str
    return log_record.get("step", {}).get("name", "-")


if __name__ == "__main__":
    main()
