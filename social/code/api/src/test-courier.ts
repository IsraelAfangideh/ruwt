import { processMessage } from './cli';
import chalk from 'chalk';

// Mock Readline
const mockRl = {
  question: (query: string, cb: (answer: string) => void) => {
    console.log(chalk.magenta("[MockRL] Question detected: ") + query);
    // Auto-answer for the blocked menu
    if (query.includes('Select [1/2]')) {
        console.log(chalk.magenta("[MockRL] Auto-answering: 1"));
        cb("1");
    } else {
        cb("");
    }
  }
} as any;

async function runTests() {
    console.log(chalk.bold("\n=== TEST 1: VENTING (Should be treated as Draft) ==="));
    console.log("Input: 'I am so sad and he is annoying me.'");
    // Expected: [BLOCKED] or [SENT] (as a message), NOT "I understand how you feel."
    await processMessage("I am so sad and he is annoying me.", mockRl);

    console.log(chalk.bold("\n=== TEST 2: COURIER (Drafting) ==="));
    console.log("Input: 'Tell him he is a jerk.'");
    // Expected: [BLOCKED] -> Rewrite
    await processMessage("Tell him he is a jerk.", mockRl);

    console.log(chalk.bold("\n=== TEST 3: IDENTITY CHECK ==="));
    console.log("Input: 'Who are you?'");
    // Expected: "I am a Runner..."
    await processMessage("Who are you?", mockRl);
}

runTests();

