const core = require("@actions/core")
const exec = require("@actions/exec")
const github = require("@actions/github")
// const gitDiff = require('git-diff')

async function cmd (cmd) {
  const outputOptions = {}
  let output = ""

  outputOptions.listeners = {
    stdout: data => {
      output += data.toString()
    },
    stderr: data => {
      output += data.toString()
    }
  }
  await exec.exec(cmd, null, outputOptions)
  return output
}

async function main() {
  try {
    // --------------- octokit initialization  ---------------
    const token = core.getInput("token")
    console.log("==== Initializing oktokit with token", token)
    const octokit = new github.GitHub(token)
    // --------------- End octokit initialization ---------------

    // --------------- Build repo  ---------------
    const bootstrap = core.getInput("bootstrap"),
      build_command = core.getInput("build_command"),
      main_branch = core.getInput("main_branch") || 'main',
      dist_path = core.getInput("dist_path")
    const context = github.context,
      pull_request = context.payload.pull_request
    console.log(github.context.payload.pull_request || github.context.payload)

    console.log(`==== Bootstrapping repo`)
    await exec.exec(bootstrap)
    console.log(`==== Building Changes`)
    await exec.exec(build_command)
    core.setOutput("Building repo completed @ ", new Date().toTimeString())
    let base_branch_name = context.sha || 'current'
    if (pull_request && pull_request.base && pull_request.base.ref) {
      base_branch_name = pull_request.base.ref
    }
    const size1 = await cmd(`/bin/bash -c "du -abh ${dist_path} | tee /tmp/new_size.txt"`)
    core.setOutput("size", size1)

    await exec.exec(`rm -rf ${dist_path}/*`)
    await exec.exec(`git remote set-branches --add origin ${main_branch}`)
    await exec.exec(`git fetch origin ${main_branch}:${main_branch}`)
    await exec.exec(`git checkout ${main_branch}`)
    console.log(`==== Bootstrapping repo`)
    await exec.exec(bootstrap)
    console.log(`==== Building Changes`)
    await exec.exec(build_command)
    core.setOutput("Building repo completed @ ", new Date().toTimeString())
    const size2 = await cmd(`/bin/bash -c "du -abh ${dist_path} | tee /tmp/old_size.txt"`)
    core.setOutput("size", size2)
    const diff = await cmd(`/bin/bash -c "git diff -w /tmp/old_size.txt /tmp/new_size.txt || true"`)

    // const arrayOutput = sizeCalOutput.split("\n")
    const body = "Bundled size for the package is listed below: \n\n```diff\n" + diff + "\n```\n"

    let result
    if (pull_request) {
      // on pull request commit push add comment to pull request
      result = await octokit.issues.createComment(
        Object.assign(Object.assign({}, context.repo), {
          issue_number: pull_request.number,
          body,
        })
      )
    } else {
      // on commit push add comment to commit
      result = await octokit.repos.createCommitComment(
        Object.assign(Object.assign({}, context.repo), {
          commit_sha: github.context.sha,
          body,
        })
      )
    }
    // console.log({ result })

    // --------------- End Comment repo size  ---------------
  } catch (error) {
    console.error(error)
    core.setFailed(error.message)
  }
}

main()
