// frontend/src/api.js

const BASE_URL = "http://localhost:8000";

export const resetEnv = async (task = "memory_recall") => {
  const res = await fetch(`${BASE_URL}/reset?task_name=${task}`);
  if (!res.ok) throw new Error(`Reset failed: ${res.status}`);
  return res.json();
};

export const stepEnv = async () => {
  const res = await fetch(`${BASE_URL}/step`);
  if (!res.ok) throw new Error(`Step failed: ${res.status}`);
  return res.json();
};