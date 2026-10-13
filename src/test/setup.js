import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// vitest.config.js doesn't set test.globals, so @testing-library/react's own
// automatic afterEach-cleanup detection doesn't fire -- register it explicitly,
// otherwise each test's rendered DOM leaks into the next test in the same file.
afterEach(() => cleanup());
