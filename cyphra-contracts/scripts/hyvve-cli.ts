#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { exec } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

// --- ESM-compatible way to get directory name ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .version('0.0.1')
  .description(
    chalk.cyan(
      'Hyvve Contracts CLI - Manage and interact with your Hyvve Sui project'
    )
  );

// Helper function to execute a TypeScript script
const executeScript = (scriptPath: string, scriptArgs: string[] = []) => {
  const fullScriptPath = path.resolve(__dirname, scriptPath);
  // Adjust the command if you are using a different ts execution (e.g. npx ts-node)
  const command = `npx ts-node ${fullScriptPath} ${scriptArgs.join(' ')}`;

  console.log(chalk.blue(`Executing: ${command}`));

  const child = exec(command);

  child.stdout?.on('data', (data) => {
    process.stdout.write(data);
  });

  child.stderr?.on('data', (data) => {
    process.stderr.write(chalk.red(data));
  });

  child.on('close', (code) => {
    if (code !== 0) {
      console.log(chalk.red(`Script exited with code ${code}`));
    } else {
      console.log(chalk.green('Script executed successfully.'));
    }
  });

  child.on('error', (error) => {
    console.error(chalk.redBright(`Failed to start script: ${error.message}`));
  });
};

// --- Placeholder for future commands ---
// Example:
// program
//   .command('example <arg1>')
//   .description('An example command')
//   .action((arg1) => {
//     console.log(chalk.yellow(`Example command executed with: ${arg1}`));
//     // To run a script:
//     // executeScript('./some-script.ts', [arg1]);
//   });

// --- Setup Commands ---
const setupCommand = program
  .command('setup')
  .description(
    chalk.blueBright(
      'Commands for setting up Hyvve infrastructure and publishing contracts.'
    )
  );

setupCommand
  .command('hyvve-infra')
  .description(
    chalk.green('Initializes Hyvve Escrow, mints tokens, and updates .env.')
  )
  .action(() => {
    executeScript('./setup/setupHyvveInfra.ts');
  });

setupCommand
  .command('populate-env-campaign')
  .description(
    chalk.green('Populates .env with Campaign Manager publish details.')
  )
  .argument('<txDigest>', 'Transaction digest of the campaign_manager publish.')
  .action((txDigest) => {
    executeScript('./setup/populateEnvFromPublish.ts', [txDigest]);
  });

setupCommand
  .command('populate-env-hyvve-token')
  .description(chalk.green('Populates .env with Hyvve Token publish details.'))
  .argument('<txDigest>', 'Transaction digest of the hyvve_token publish.')
  .action((txDigest) => {
    executeScript('./setup/populateEnvFromHyvveTokenPublish.ts', [txDigest]);
  });

// --- Campaign Commands ---
const campaignCommand = program
  .command('campaign')
  .description(chalk.blueBright('Commands for managing campaigns.'));

campaignCommand
  .command('create')
  .description(chalk.green('Creates a new campaign.'))
  .option(
    '-c, --campaign-id <id>',
    'Unique ID for the campaign (e.g., campaign_123)'
  )
  .option('-t, --title <title>', 'Title of the campaign')
  .option('-d, --description <desc>', 'Description of the campaign')
  .option(
    '-r, --data-requirements <reqs>',
    'Data requirements for the campaign'
  )
  .option(
    '-q, --quality-criteria <criteria>',
    'Quality criteria for contributions'
  )
  .option(
    '-p, --unit-price <price>',
    'Unit price per contribution (in smallest token unit, e.g., MIST for SUI/Hyvve)'
  )
  .option(
    '-b, --total-budget <budget>',
    'Total budget for the campaign (in smallest token unit)'
  )
  .option('--min-data <count>', 'Minimum data count')
  .option('--max-data <count>', 'Maximum data count')
  .option('-e, --expiration <epoch>', 'Expiration epoch timestamp')
  .option('-m, --metadata-uri <uri>', 'Metadata URI (e.g., IPFS)')
  .option('--encryption-key <key>', 'Public encryption key for data')
  .option(
    '--token-type <type>',
    'Token type for the campaign (e.g., 0x2::sui::SUI or Hyvve token type). Defaults to HYVVE_TOKEN_TYPE from .env'
  )
  .action((options) => {
    // We'll need to pass these options to the createCampaign.ts script.
    // This might involve modifying createCampaign.ts to accept CLI args,
    // or using environment variables. For now, let's assume createCampaign.ts
    // primarily uses .env and we are calling it.
    // A more robust solution would be to pass all these as arguments.
    console.log(
      chalk.yellow(
        'Executing create campaign. Make sure .env is configured or pass necessary options.'
      )
    );
    console.log(
      chalk.yellow(
        'Note: Current createCampaign.ts script might not accept all these CLI options directly. It primarily uses environment variables or hardcoded values. This command serves as a placeholder for future enhancement or direct execution.'
      )
    );

    const scriptArgs: string[] = [];
    if (options.campaignId)
      scriptArgs.push(`--campaign-id`, options.campaignId);
    if (options.title) scriptArgs.push(`--title`, options.title);
    if (options.description)
      scriptArgs.push(`--description`, options.description);
    if (options.dataRequirements)
      scriptArgs.push(`--data-requirements`, options.dataRequirements);
    if (options.qualityCriteria)
      scriptArgs.push(`--quality-criteria`, options.qualityCriteria);
    if (options.unitPrice) scriptArgs.push(`--unit-price`, options.unitPrice);
    if (options.totalBudget)
      scriptArgs.push(`--total-budget`, options.totalBudget);
    if (options.minData) scriptArgs.push(`--min-data`, options.minData);
    if (options.maxData) scriptArgs.push(`--max-data`, options.maxData);
    if (options.expiration) scriptArgs.push(`--expiration`, options.expiration);
    if (options.metadataUri)
      scriptArgs.push(`--metadata-uri`, options.metadataUri);
    if (options.encryptionKey)
      scriptArgs.push(`--encryption-key`, options.encryptionKey);
    if (options.tokenType) scriptArgs.push(`--token-type`, options.tokenType);

    // Assuming createCampaign.ts is in campaign/createCampaign.ts
    executeScript('./campaign/createCampaign.ts', scriptArgs);
  });

// --- Contribution Commands ---
const contributionCommand = program
  .command('contribution')
  .description(chalk.blueBright('Commands for managing contributions.'));

contributionCommand
  .command('submit')
  .description(chalk.green('Submits a new contribution to a campaign.'))
  .argument('<campaignId>', 'The ID of the campaign to contribute to.')
  .option(
    '-u, --data-url <url>',
    'URL of the contribution data (e.g., IPFS link).',
    'ipfs://default-data-url'
  )
  .option(
    '-h, --data-hash <hash>',
    'Hash of the contribution data.',
    'default_hash_value'
  )
  .option(
    '-q, --quality-score <score>',
    'Quality score of the contribution (0-100).',
    '80'
  )
  .action((campaignId, options) => {
    // The existing submitContribution.ts script uses hardcoded values or .env for some details.
    // We'll pass campaignId and other options if the script is modified to accept them.
    // For now, it will execute the script which will use its internal logic.
    // To make this truly CLI driven, submitContribution.ts would need to be refactored
    // to accept all these parameters as arguments.
    console.log(
      chalk.yellow(`Executing submit contribution for campaign: ${campaignId}`)
    );
    console.log(
      chalk.yellow(
        'Note: submitContribution.ts script might use its own internal configuration for some parameters.'
      )
    );

    const scriptArgs = [
      `--campaign-id`,
      campaignId, // This assumes submitContribution.ts can parse this
      `--data-url`,
      options.dataUrl,
      `--data-hash`,
      options.dataHash,
      `--quality-score`,
      options.qualityScore,
    ];
    executeScript('./contribution/submitContribution.ts', scriptArgs);
  });

// --- Stats Commands ---
const statsCommand = program
  .command('stats')
  .description(
    chalk.blueBright('Commands for fetching and displaying statistics.')
  );

statsCommand
  .command('active-data')
  .description(chalk.green('Gets active campaign data and contributor stats.'))
  .argument('<campaignId>', 'The ID of the campaign to fetch data for.')
  .action((campaignId) => {
    // Assuming getActiveData.ts is in stats/getActiveData.ts
    // and it can take campaignId as an argument or uses a default/env var.
    // The script might need modification to accept campaignId via CLI.
    executeScript('./stats/getActiveData.ts', [campaignId]);
  });

// --- Verifier Commands ---
const verifierCommand = program
  .command('verifier')
  .description(
    chalk.blueBright('Commands for managing verifiers and their reputations.')
  );

verifierCommand
  .command('add')
  .description(chalk.green('Adds a new verifier to the registry.'))
  .argument('<verifierAddress>', 'Sui address of the verifier.')
  .argument('<publicKey>', "Verifier's Ed25519 public key (hex string).")
  .action((verifierAddress, publicKey) => {
    console.log(
      chalk.yellow(
        `Adding verifier ${verifierAddress} with public key ${publicKey}`
      )
    );
    // Assuming a script like ./verifier/addVerifier.ts exists
    executeScript('./verifier/addVerifier.ts', [verifierAddress, publicKey]);
  });

verifierCommand
  .command('remove')
  .description(
    chalk.green('Removes (deactivates) a verifier from the registry.')
  )
  .argument('<verifierAddress>', 'Sui address of the verifier to remove.')
  .action((verifierAddress) => {
    console.log(chalk.yellow(`Removing verifier ${verifierAddress}`));
    // Assuming a script like ./verifier/removeVerifier.ts exists
    executeScript('./verifier/removeVerifier.ts', [verifierAddress]);
  });

verifierCommand
  .command('add-key')
  .description(
    chalk.green("Adds a verifier's public key to the VerifierStore.")
  )
  .argument('<publicKey>', "Verifier's Ed25519 public key (hex string).")
  .action((publicKey) => {
    console.log(chalk.yellow(`Adding verifier key ${publicKey}`));
    // Assuming a script like ./verifier/addVerifierKey.ts exists
    executeScript('./verifier/addVerifierKey.ts', [publicKey]);
  });

verifierCommand
  .command('update-reputation')
  .description(chalk.green('Updates the reputation score for a verifier key.'))
  .argument('<publicKey>', "Verifier's Ed25519 public key (hex string).")
  .argument('<newScore>', 'The new reputation score (0-100).')
  .action((publicKey, newScore) => {
    console.log(
      chalk.yellow(`Updating reputation for key ${publicKey} to ${newScore}`)
    );
    // Assuming a script like ./verifier/updateReputation.ts exists
    executeScript('./verifier/updateReputation.ts', [publicKey, newScore]);
  });

verifierCommand
  .command('get-info')
  .description(
    chalk.green('Gets information about a verifier using their public key.')
  )
  .argument('<publicKey>', "Verifier's Ed25519 public key (hex string).")
  .action((publicKey) => {
    console.log(chalk.yellow(`Getting info for verifier key ${publicKey}`));
    // Assuming a script like ./verifier/getVerifierInfo.ts exists
    executeScript('./verifier/getVerifierInfo.ts', [publicKey]);
  });

// --- Reputation Commands ---
const reputationCommand = program
  .command('reputation')
  .description(
    chalk.blueBright('Commands for managing and querying user reputations.')
  );

reputationCommand
  .command('get-score')
  .description(
    chalk.green('Gets the reputation score for a given Sui address.')
  )
  .argument('<userAddress>', 'Sui address of the user.')
  .action((userAddress) => {
    console.log(
      chalk.yellow(`Fetching reputation score for address ${userAddress}`)
    );
    // Assuming a script like ./reputation/getReputationScore.ts exists
    executeScript('./reputation/getReputationScore.ts', [userAddress]);
  });

// Placeholder for other reputation commands, e.g.:
// reputationCommand
//   .command('update-params')
//   .description(chalk.yellow('Admin: Updates reputation system parameters (Placeholder).'))
//   .option('--decay-rate <rate>', 'Set new decay rate')
//   .action((options) => {
//     console.log(chalk.magenta('This is a placeholder for updating reputation parameters.'));
//     // executeScript('./reputation/updateReputationParams.ts', [options.decayRate]);
//   });

// Add more commands for token_legacy, subscription as needed.
program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
