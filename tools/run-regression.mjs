import { readFileSync } from 'node:fs';
import vm from 'node:vm';

globalThis.readFile = (filePath) => readFileSync(filePath, 'utf8');
globalThis.load = (filePath) => vm.runInThisContext(readFileSync(filePath, 'utf8'), { filename: filePath });
globalThis.print = (...values) => console.log(...values);

vm.runInThisContext(readFileSync('tests/run-tests.js', 'utf8'), { filename: 'tests/run-tests.js' });
