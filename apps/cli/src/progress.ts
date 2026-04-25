import Spinnies from "spinnies";

export type ProgressReporter = Pick<Spinnies, "add" | "update" | "succeed" | "fail" | "pick" | "remove">;

type ProgressStatus = "spinning" | "succeed" | "fail" | "stopped";
type ProgressRecord = Record<string, any> & { text: string; status: ProgressStatus };
type ProgressStream = Pick<NodeJS.WriteStream, "write">;

const ESCAPE_CHARACTER = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(`${ESCAPE_CHARACTER}\\[[0-?]*[ -/]*[@-~]`, "g");

function visibleText(value: string): string {
    return value.replace(ANSI_PATTERN, "");
}

export function dedupeRawProgressReporter(base: ProgressReporter, stream: ProgressStream = process.stderr): ProgressReporter {
    const records = new Map<string, ProgressRecord>();
    const lastVisibleLines = new Map<string, string>();

    const emit = (name: string, options: Record<string, any> = {}, status: ProgressStatus = "spinning"): ProgressRecord => {
        const previous = records.get(name);
        const next: ProgressRecord = {
            ...previous,
            ...options,
            text: options.text ?? previous?.text ?? name,
            status
        };

        records.set(name, next);

        const visible = visibleText(next.text);
        if (lastVisibleLines.get(name) !== visible) {
            stream.write(`- ${next.text}\n`);
            lastVisibleLines.set(name, visible);
        }

        if (status === "succeed" || status === "fail" || status === "stopped") {
            records.delete(name);
        }

        return next;
    };

    return {
        ...base,
        pick(name: string) {
            return records.get(name) ?? null;
        },
        add(name: string, options: Record<string, any> = {}) {
            return emit(name, options, "spinning");
        },
        update(name: string, options: Record<string, any> = {}) {
            return emit(name, options, options.status ?? "spinning");
        },
        succeed(name: string, options: Record<string, any> = {}) {
            return emit(name, options, "succeed");
        },
        fail(name: string, options: Record<string, any> = {}) {
            return emit(name, options, "fail");
        },
        remove(name: string) {
            const removed = records.get(name) ?? null;
            records.delete(name);
            lastVisibleLines.delete(name);
            return removed as any;
        }
    };
}

export function createSyncProgressReporter(): ProgressReporter {
    const spinnies = new Spinnies({ disableSpins: true }) as ProgressReporter & { spin?: boolean };

    if (spinnies.spin === false) {
        return dedupeRawProgressReporter(spinnies);
    }

    return spinnies;
}
