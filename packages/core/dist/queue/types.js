export var JobType;
(function (JobType) {
    JobType["ARCHITECT_STAGE"] = "ARCHITECT_STAGE";
    JobType["PLANNER_STAGE"] = "PLANNER_STAGE";
    JobType["SCENE_GENERATION"] = "SCENE_GENERATION";
    JobType["PROSE_GENERATION"] = "PROSE_GENERATION";
    JobType["PROSE_REVISION"] = "PROSE_REVISION";
})(JobType || (JobType = {}));
export var QueueName;
(function (QueueName) {
    QueueName["GENERATION_QUEUE"] = "generation_queue";
})(QueueName || (QueueName = {}));
export var JobStatus;
(function (JobStatus) {
    JobStatus["QUEUED"] = "QUEUED";
    JobStatus["RUNNING"] = "RUNNING";
    JobStatus["COMPLETED"] = "COMPLETED";
    JobStatus["FAILED"] = "FAILED";
    JobStatus["PAUSED"] = "PAUSED";
    JobStatus["CANCELLED"] = "CANCELLED";
})(JobStatus || (JobStatus = {}));
