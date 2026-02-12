"use strict";

const { execFileSync } = require("child_process");

function runGit(args, options = {}) {
  try {
    return execFileSync("git", args, { encoding: "utf8", ...options }).trimEnd();
  } catch (err) {
    const stderr = err && err.stderr ? String(err.stderr) : "";
    const stdout = err && err.stdout ? String(err.stdout) : "";
    const code = err && err.status ? err.status : "unknown";
    const msg = `git command failed (code ${code}): ${stderr || stdout || "unknown error"}`;
    throw new Error(msg.trim());
  }
}

function isGitRepo(cwd) {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function getDiff(cwd, staged) {
  const args = staged ? ["diff", "--staged"] : ["diff"];
  return runGit(args, { cwd });
}

module.exports = { runGit, isGitRepo, getDiff };
