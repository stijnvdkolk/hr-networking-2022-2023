import { prompt } from 'enquirer';
import fs from 'node:fs/promises';

const MULTICODE_NODEBOOK = 'CB91ijY6';
const folderRegex = /(\d+)_(?:week|question)-\d+/;

function partialMatch<T extends string>(list: T[], match: T) {
  return list.some((item) => item.includes(match));
}

interface WeekNumberData {
  weekNumber: number;
  newWeekNumberFolder: string;
}

async function weekNumber(): Promise<WeekNumberData> {
  const { weekNumber } = await prompt<{ weekNumber: number }>({
    type: 'numeral',
    name: 'weekNumber',
    message: 'What week is the quiz for?',
  });
  if (weekNumber <= 0) {
    console.error('Week number must be greater than 0');
    process.exit(1);
  }
  const directories = (await fs.readdir(process.cwd(), { withFileTypes: true }))
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
  if (partialMatch(directories, `week-${weekNumber}`)) {
    console.error(`A folder for week ${weekNumber} already exists`);
    process.exit(1);
  }
  // Format week folder XX_week-X
  // Sort directories by starting number after filtering out the non week folders
  const sortedDirectories = directories
    .filter((directory) => directory.includes('week-'))
    .sort((a, b) => {
      console.log(a, folderRegex.exec(a));
      const aNumber = Number(folderRegex.exec(a)![1]);
      const bNumber = Number(folderRegex.exec(b)![1]);
      return aNumber - bNumber;
    })
    .reverse();
  const lastWeekStartingNumber = Number(
    sortedDirectories[0].match(folderRegex)[1]
  );
  const newWeekNumberFolder = `${String(lastWeekStartingNumber + 1).padStart(
    2,
    '0'
  )}_week-${weekNumber}`;
  console.log(`Creating folder ${newWeekNumberFolder}`);
  await fs.mkdir(newWeekNumberFolder);
  // Create README.md
  await fs.writeFile(
    `${newWeekNumberFolder}/README.md`,
    `https://multicode.app/n/${MULTICODE_NODEBOOK}/sync/file/week-${weekNumber}\n\n# Week ${weekNumber} Quiz`
  );
  return { weekNumber, newWeekNumberFolder };
}

async function createQuestion(
  weekData: WeekNumberData,
  questionNumber: number
) {
  const questionFolder = `${weekData.newWeekNumberFolder}/${String(
    questionNumber + -1
  ).padStart(2, '0')}_question-${questionNumber}`;
  await fs.mkdir(questionFolder);
  const { question } = await prompt<{ question: string }>({
    type: 'input',
    name: 'question',
    message: `What is the question for question ${questionNumber}?`,
  });
  await fs.writeFile(
    `${questionFolder}/README.md`,
    `https://multicode.app/n/${MULTICODE_NODEBOOK}/sync/file/week-${weekData.weekNumber}-q${questionNumber}\n\n# Question ${questionNumber}\n\n\`\`\`yaml\ntype: multiple_choice\n\`\`\`\n\n${question}`
  );
  await fs.mkdir(`${questionFolder}/answers`);
  const { amountOfAnswers } = await prompt<{ amountOfAnswers: number }>({
    type: 'numeral',
    name: 'amountOfAnswers',
    message: `How many answers are there for question ${questionNumber}?`,
  });
  if (amountOfAnswers <= 0) {
    return createQuestion(weekData, questionNumber);
  }
  for (let i = 0; i < amountOfAnswers; i++) {
    const { answer, correct } = await prompt<{
      answer: string;
      correct: boolean;
    }>([
      {
        type: 'input',
        name: 'answer',
        message: `What is the answer?`,
      },
      {
        type: 'confirm',
        name: 'correct',
        message: `Is this answer correct?`,
      },
    ]);
    await fs.writeFile(
      `${questionFolder}/answers/${String(i + 1).padStart(2, '0')}${
        correct ? '_correct' : ''
      }.md`,
      answer
    );
  }
}

async function bootstrap() {
  const weekNumberData = await weekNumber();
  const { amountOfQuestions } = await prompt<{ amountOfQuestions: number }>({
    type: 'numeral',
    name: 'amountOfQuestions',
    message: 'How many questions are there in the quiz?',
  });
  if (amountOfQuestions <= 0) {
    console.error('Amount of questions must be greater than 0');
    process.exit(1);
  }
  for (let i = 0; i < amountOfQuestions; i++) {
    await createQuestion(weekNumberData, i + 1);
  }
}

bootstrap();
