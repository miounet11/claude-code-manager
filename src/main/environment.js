'use strict';

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function checkCommand(command, versionFlag = '--version') {
  try {
    const { stdout } = await execPromise(`${command} ${versionFlag}`);
    return {
      installed: true,
      version: stdout.trim().split('\n')[0]
    };
  } catch (error) {
    return {
      installed: false,
      version: null
    };
  }
}

async function checkEnvironment() {
  const checks = {
    nodejs: await checkNodejs(),
    git: await checkGit(),
    uv: await checkUV(),
    claude: await checkClaudeCode()
  };

  return checks;
}

async function checkNodejs() {
  const result = await checkCommand('node', '-v');
  if (result.installed) {
    const version = result.version.replace('v', '');
    const major = parseInt(version.split('.')[0]);
    result.compatible = major >= 16;
  }
  return result;
}

async function checkGit() {
  const result = await checkCommand('git', '--version');
  if (result.installed) {
    result.version = result.version.replace('git version ', '');
  }
  return result;
}

async function checkUV() {
  return await checkCommand('uv', '--version');
}

async function checkClaudeCode() {
  return await checkCommand('claude', '--version');
}

module.exports = {
  checkEnvironment,
  checkNodejs,
  checkGit,
  checkUV,
  checkClaudeCode
};