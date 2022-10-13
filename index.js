const core = require("@actions/core")
const exec = require("@actions/exec")
const github = require("@actions/github")
const axios = require('axios')
// const gitDiff = require('git-diff')

const CIDIFF_API = 'https://cidiff-bupezyolyq-ue.a.run.app/api'

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
    const cidiff_account = core.getInput("cidiff_account")
    console.log("==== Initializing CIDIFF with cidiff_account", cidiff_account)
    const cidiff_api_key = core.getInput("cidiff_api_key")
    console.log("==== Initializing CIDIFF with cidiff_api_key", cidiff_api_key)

    // --------------- Build repo  ---------------
    const bootstrap = core.getInput("bootstrap")
    const build_command = core.getInput("build_command")
    const main_branch = core.getInput("main_branch") || 'main'
    const dist_path = core.getInput("dist_path")
    const context = github.context
    const pull_request = context.payload.pull_request
    // console.log('github', github)
    console.log('github.context', context)
    console.log('github.pull_request', pull_request)
    // console.log('github.context.payload', github.context.payload)
    // console.log('pull_request', pull_request)
    // console.log('pull_request.base', pull_request.base)
    // console.log('pull_request.base.repo', pull_request.base.repo)
    // console.log('pull_request.base.repo.id', pull_request.base.repo.id)
    // console.log(pull_request || github.context.payload)
    const repo_id = pull_request.base.repo.id
    const repo_host = 'github'
    // AKA current branch
    const head_sha = (pull_request && pull_request.head) ? pull_request.head.sha : (context.sha)
    // AKA main branch
    const base_sha = (pull_request && pull_request.base) ? pull_request.base.sha : null
    console.log({
      'context.sha': context.sha,
      'pull_request.base.sha': pull_request ? pull_request.base.sha : null,
      base_sha,
      head_sha,
    })

    console.log(`==== Bootstrapping repo`)
    await exec.exec(bootstrap)
    console.log(`==== Building Changes`)
    await exec.exec(build_command)
    core.setOutput("Building repo completed @ ", new Date().toTimeString())
    let base_branch_name = context.sha || 'current'
    if (pull_request && pull_request.base && pull_request.base.ref) {
      base_branch_name = pull_request.base.ref
    }
    const du_abh_output_file = '/tmp/du_abh.txt'
    const size1 = await cmd(`/bin/bash -c "du -abh ${dist_path} | tee ${du_abh_output_file}"`)
    core.setOutput("size", size1)
    const send_size = await cmd(`/bin/bash -c "curl -v ${CIDIFF_API}/files -X POST \
      -F repo_id=${repo_id} \
      -F repo_host=${repo_host} \
      -F head_sha=${head_sha} \
      -F du_abh.txt=@${du_abh_output_file} \
      -H 'Authorization: Bearer ${cidiff_account}:${cidiff_api_key}'"`)
    // console.log(send_size)

    let result
    if (pull_request) {
      const diffReport = await axios.get(`${CIDIFF_API}/filediffreport`, {
        params: {
          type: 'pull_request',
          repo_id,
          repo_host,
          head_sha,
          base_sha,
        },
        headers: {
          Authorization: `Bearer ${cidiff_account}:${cidiff_api_key}`,
        },
      })
      console.log('diffReport', diffReport)

      // const body = makePullRequestBody(diffReport)
      const body = "Bundled size for the package is listed below: \n\n```diff\n" + 'diff' + "\n```\n"
      // on pull request commit push add comment to pull request
      result = await octokit.issues.createComment(
        Object.assign(Object.assign({}, context.repo), {
          issue_number: pull_request.number,
          body: diffReport.data.body_md,
        })
      )
    } else {
      // no action necessary for commits
      // throw new Error('no defined behavior for commit, expected pull_request');
      // on commit push add comment to commit
      // result = await octokit.repos.createCommitComment(
      //   Object.assign(Object.assign({}, context.repo), {
      //     commit_sha: github.context.sha,
      //     body,
      //   })
      // )
    }
    // console.log({ result })

    // --------------- End Comment repo size  ---------------
  } catch (error) {
    console.error(error)
    core.setFailed(error.message)
  }
}

function makePullRequestBody(diffReport) {
  let body = ''
  for (const key of diffReport) {

  }
}

main()
