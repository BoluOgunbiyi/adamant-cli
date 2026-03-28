import chalk from 'chalk';
import ora from 'ora';

const SAMPLE_DIFF = `
  src/components/checkout/PaymentStep.tsx
  ${chalk.red('- export function PaymentStep({ methods }) {')}
  ${chalk.red('-   return (')}
  ${chalk.red('-     <div className="payment-step">')}
  ${chalk.red('-       {methods.map(m => <PaymentMethod key={m.id} {...m} />)}')}
  ${chalk.green('+ export function PaymentStep({ methods, isLoading }) {')}
  ${chalk.green('+   if (isLoading) {')}
  ${chalk.green('+     return <PaymentSkeleton />;')}
  ${chalk.green('+   }')}
  ${chalk.green('+')}
  ${chalk.green('+   return (')}
  ${chalk.green('+     <div className="payment-step">')}
  ${chalk.green('+       {methods.map(m => <PaymentMethod key={m.id} {...m} />)}')}
`;

const SAMPLE_PR = `
  ${chalk.bold('What users experience now:')} Users reach the payment step
  and see a blank screen for 3-5 seconds while payment methods load.
  No spinner, no feedback. Many assume the page is broken and leave.

  ${chalk.bold('What users will experience after:')} A loading skeleton
  appears immediately with a "Loading payment methods..." message.

  ${chalk.bold('Expected impact:')} Reduced drop-off at checkout step 3.
`;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runDemo() {
  console.log('');
  console.log(chalk.bold('  Welcome to Adamant!'));
  console.log(chalk.dim('  English to Pull Request in 60 seconds.'));
  console.log('');
  console.log(chalk.dim('  Simulating: adamant wish "users keep abandoning checkout at step 3"'));
  console.log('');

  const spinner = ora({ text: 'Reading your codebase...', indent: 2 }).start();
  await sleep(1200);
  spinner.text = 'Understanding the problem...';
  await sleep(1200);
  spinner.text = 'Finding the right files...';
  await sleep(1000);
  spinner.text = 'Writing the fix...';
  await sleep(1500);
  spinner.succeed('Wish granted (demo)');

  console.log('');
  console.log(chalk.bold('  Changes:'));
  console.log(SAMPLE_DIFF);
  console.log('');
  console.log(chalk.bold('  PR Description:'));
  console.log(SAMPLE_PR);

  console.log('');
  console.log('  ' + chalk.yellow('That was a demo.') + ' With your own API key,');
  console.log('  Adamant does this for real on YOUR codebase.');
  console.log('');
  console.log('  Set up now (30 seconds):');
  console.log(chalk.cyan('    adamant wish "describe your problem here"'));
  console.log('');
  console.log('  Or install globally:');
  console.log(chalk.cyan('    npm install -g adamant-cli'));
  console.log('');
}
