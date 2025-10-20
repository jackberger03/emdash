import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useFileDiff, type DiffLine } from '../hooks/useFileDiff';
import { type FileChange } from '../hooks/useFileChanges';

interface ChangesDiffModalProps {
  open: boolean;
  onClose: () => void;
  workspacePath: string;
  files: FileChange[];
  initialFile?: string;
}

const Line: React.FC<{ text?: string; type: DiffLine['type']; lineNum?: number }> = ({
  text = '',
  type,
  lineNum,
}) => {
  const bgCls =
    type === 'add'
      ? 'bg-emerald-50/80 dark:bg-emerald-900/20'
      : type === 'del'
        ? 'bg-rose-50/80 dark:bg-rose-900/20'
        : 'bg-transparent';

  const textCls =
    type === 'add'
      ? 'text-emerald-900 dark:text-emerald-200'
      : type === 'del'
        ? 'text-rose-900 dark:text-rose-200'
        : 'text-gray-800 dark:text-gray-300';

  const borderCls =
    type === 'add'
      ? 'border-l-2 border-emerald-500 dark:border-emerald-400'
      : type === 'del'
        ? 'border-l-2 border-rose-500 dark:border-rose-400'
        : 'border-l-2 border-transparent';

  const symbol = type === 'add' ? '+' : type === 'del' ? '-' : ' ';

  return (
    <div className={`flex items-start ${bgCls} ${borderCls}`}>
      <div className="flex min-w-0 flex-1">
        <div className="w-12 flex-shrink-0 select-none px-2 py-1 text-right font-mono text-xs text-gray-500 dark:text-gray-500">
          {lineNum !== undefined ? lineNum : ''}
        </div>
        <div className="w-6 flex-shrink-0 select-none px-1 py-1 text-center font-mono text-xs text-gray-600 dark:text-gray-400">
          {symbol}
        </div>
        <div
          className={`min-w-0 flex-1 whitespace-pre-wrap break-words px-3 py-1 font-mono text-[13px] leading-6 ${textCls}`}
        >
          {text}
        </div>
      </div>
    </div>
  );
};

export const ChangesDiffModal: React.FC<ChangesDiffModalProps> = ({
  open,
  onClose,
  workspacePath,
  files,
  initialFile,
}) => {
  const [selected, setSelected] = useState<string | undefined>(initialFile || files[0]?.path);
  const { lines, loading } = useFileDiff(workspacePath, selected);
  const shouldReduceMotion = useReducedMotion();

  const grouped = useMemo(() => {
    // Convert linear diff into rows for side-by-side
    const rows: Array<{
      left?: DiffLine & { lineNum?: number };
      right?: DiffLine & { lineNum?: number };
    }> = [];
    let leftLine = 1;
    let rightLine = 1;

    for (const l of lines) {
      if (l.type === 'context') {
        rows.push({
          left: { ...l, left: l.left, right: undefined, lineNum: leftLine },
          right: { ...l, right: l.right, left: undefined, lineNum: rightLine },
        });
        leftLine++;
        rightLine++;
      } else if (l.type === 'del') {
        rows.push({ left: { ...l, lineNum: leftLine } });
        leftLine++;
      } else if (l.type === 'add') {
        // Try to pair with previous deletion if it exists and right is empty
        const last = rows[rows.length - 1];
        if (last && last.right === undefined && last.left && last.left.type === 'del') {
          last.right = { ...l, lineNum: rightLine };
        } else {
          rows.push({ right: { ...l, lineNum: rightLine } });
        }
        rightLine++;
      }
    }
    return rows;
  }, [lines]);

  if (typeof document === 'undefined') {
    return null;
  }
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.12, ease: 'easeOut' }}
          onClick={onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              shouldReduceMotion
                ? { opacity: 1, y: 0, scale: 1 }
                : { opacity: 0, y: 6, scale: 0.995 }
            }
            transition={
              shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }
            }
            className="flex h-[82vh] w-[92vw] transform-gpu overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl will-change-transform dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="w-72 overflow-y-auto border-r border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40">
              <div className="px-3 py-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Changed Files
              </div>
              {files.map((f) => (
                <button
                  key={f.path}
                  className={`w-full border-b border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-700 ${
                    selected === f.path
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                  onClick={() => setSelected(f.path)}
                >
                  <div className="truncate font-medium">{f.path}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {f.status} • +{f.additions} / -{f.deletions}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-gray-200 bg-white/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/50">
                <div className="truncate text-sm text-gray-700 dark:text-gray-200">{selected}</div>
                <button
                  onClick={onClose}
                  className="rounded-md p-1 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-auto">
                {loading ? (
                  <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
                    Loading diff…
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-px bg-gray-300 dark:bg-gray-700">
                    <div className="bg-white dark:bg-gray-900">
                      <div className="sticky top-0 z-10 flex items-center border-b border-gray-300 bg-gray-100 px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                        <div className="w-12 text-right font-mono text-xs font-semibold text-gray-600 dark:text-gray-400">
                          Line
                        </div>
                        <div className="ml-6 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Before
                        </div>
                      </div>
                      {grouped.map((r, idx) => (
                        <Line
                          key={`l-${idx}`}
                          text={r.left?.left ?? r.left?.right}
                          type={r.left?.type || 'context'}
                          lineNum={r.left?.lineNum}
                        />
                      ))}
                    </div>
                    <div className="bg-white dark:bg-gray-900">
                      <div className="sticky top-0 z-10 flex items-center border-b border-gray-300 bg-gray-100 px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                        <div className="w-12 text-right font-mono text-xs font-semibold text-gray-600 dark:text-gray-400">
                          Line
                        </div>
                        <div className="ml-6 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          After
                        </div>
                      </div>
                      {grouped.map((r, idx) => (
                        <Line
                          key={`r-${idx}`}
                          text={r.right?.right ?? r.right?.left}
                          type={r.right?.type || 'context'}
                          lineNum={r.right?.lineNum}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ChangesDiffModal;
