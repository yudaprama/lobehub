-- Drop agent evaluation tables (feature removed for self-hosted deployments)
DROP TABLE IF EXISTS agent_eval_run_topics CASCADE;
DROP TABLE IF EXISTS agent_eval_runs CASCADE;
DROP TABLE IF EXISTS agent_eval_test_cases CASCADE;
DROP TABLE IF EXISTS agent_eval_datasets CASCADE;
DROP TABLE IF EXISTS agent_eval_experiment_benchmarks CASCADE;
DROP TABLE IF EXISTS agent_eval_experiments CASCADE;
DROP TABLE IF EXISTS agent_eval_benchmarks CASCADE;
