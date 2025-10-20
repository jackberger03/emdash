import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import type { Message } from '../types/chat';
import { parseCodexOutput, parseCodexStream } from '../lib/codexParse';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning';
import { Response } from '@/components/ai-elements/response';
import { CodeBlock, CodeBlockCopyButton } from '@/components/ai-elements/code-block';
import StreamingAction from './StreamingAction';
import { Badge } from '@/components/ui/badge';
import FileTypeIcon from '@/components/ui/file-type-icon';
import ThinkingDots from '@/components/ai-elements/thinking-dots';

function basename(p: string): string {
  const b = p.split('/').pop() || p;
  return b;
}
function extname(p: string): string {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  if (i <= 0) return '';
  return b.slice(i + 1).toUpperCase();
}

interface MessageListProps {
  messages: Message[];
  streamingOutput: string | null;
  isStreaming?: boolean;
  awaitingThinking?: boolean;
  providerId?: 'codex' | 'claude';
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  streamingOutput,
  isStreaming = false,
  awaitingThinking = false,
  providerId = 'codex',
}) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [followOutput, setFollowOutput] = useState<boolean | 'smooth' | 'auto'>('smooth');
  const isUserScrollingRef = useRef(false);

  // Reset user scrolling flag when streaming starts
  useEffect(() => {
    if (isStreaming && !isUserScrollingRef.current) {
      setFollowOutput('smooth');
    }
  }, [isStreaming]);

  const renderMessage = useCallback(
    (index: number, message: Message) => {
      const isUserMessage = message.sender === 'user';
      const content = message.content ?? '';
      const trimmedContent = content.trim();
      if (!isUserMessage && !trimmedContent) return null;

      // Parse agent outputs for reasoning blocks
      const parsed = !isUserMessage && trimmedContent ? parseCodexOutput(trimmedContent) : null;

      return (
        <div className={`flex ${isUserMessage ? 'justify-end' : 'justify-start'} mb-6`}>
          <div
            className={`max-w-[80%] px-4 py-3 font-sans text-sm leading-relaxed text-gray-900 dark:text-gray-100 ${
              isUserMessage ? 'rounded-md bg-gray-100 dark:bg-gray-700' : ''
            }`}
          >
            {isUserMessage ? (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown
                  components={{
                    code: ({ inline, className, children, ...props }: any) => {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <pre className="overflow-x-auto rounded-md bg-gray-100 p-3 dark:bg-gray-800">
                          <code className={className} {...props}>
                            {children}
                          </code>
                        </pre>
                      ) : (
                        <code
                          className="rounded bg-gray-100 px-1 py-0.5 text-sm dark:bg-gray-800"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    },
                    ul: ({ children }) => (
                      <ul className="my-2 list-inside list-disc space-y-1">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="my-2 list-inside list-decimal space-y-1">{children}</ol>
                    ),
                    li: ({ children }) => <li className="ml-2">{children}</li>,
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                  }}
                >
                  {content}
                </ReactMarkdown>
                {Array.isArray(message.attachments) && message.attachments.length > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {message.attachments.map((p) => (
                      <Badge key={p} className="flex items-center gap-1">
                        <FileTypeIcon path={p} type="file" className="h-3.5 w-3.5" />
                        <span>{basename(p)}</span>
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                {parsed?.reasoning ? (
                  <Reasoning className="w-full" isStreaming={false} defaultOpen={false}>
                    <ReasoningTrigger />
                    <ReasoningContent>{parsed.reasoning || ''}</ReasoningContent>
                  </Reasoning>
                ) : null}
                <Response>{parsed ? parsed.response : trimmedContent}</Response>
              </div>
            )}
          </div>
        </div>
      );
    },
    [providerId]
  );

  const renderFooter = useCallback(() => {
    if (streamingOutput === null) return null;

    return (
      <div className="mb-6 flex justify-start">
        <div className="max-w-[80%] px-4 py-3 font-sans text-sm leading-relaxed text-gray-900 dark:text-gray-100">
          {providerId === 'codex' ? (
            (() => {
              const parsed = parseCodexStream(streamingOutput || '');
              if (awaitingThinking) return <ThinkingDots />;
              return (
                <div className="space-y-3">
                  {parsed.reasoning ? (
                    <Reasoning className="w-full" isStreaming={!!isStreaming} defaultOpen={false}>
                      <ReasoningTrigger />
                      <ReasoningContent>{parsed.reasoning || ''}</ReasoningContent>
                    </Reasoning>
                  ) : null}
                  {parsed.hasCodex && parsed.response ? (
                    <Response>{parsed.response}</Response>
                  ) : null}
                  {parsed && parsed.actions && parsed.actions.length > 0 ? (
                    <StreamingAction text={parsed.actions[parsed.actions.length - 1]} />
                  ) : null}
                </div>
              );
            })()
          ) : (
            <div className="space-y-3">
              {streamingOutput && streamingOutput.trim().length > 0 ? (
                <Response>{streamingOutput}</Response>
              ) : null}
              {isStreaming ? <ThinkingDots /> : null}
            </div>
          )}
        </div>
      </div>
    );
  }, [streamingOutput, isStreaming, awaitingThinking, providerId]);

  return (
    <div
      className="flex-1 overflow-hidden"
      style={{
        maskImage: 'linear-gradient(to bottom, black 0%, black 93%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 93%, transparent 100%)',
      }}
    >
      <Virtuoso
        ref={virtuosoRef}
        data={messages}
        itemContent={renderMessage}
        followOutput={followOutput}
        alignToBottom
        increaseViewportBy={{ top: 200, bottom: 200 }}
        components={{
          Footer: renderFooter,
        }}
        style={{ height: '100%' }}
        className="px-6 pb-2 pt-6"
        atBottomStateChange={(atBottom) => {
          // When user scrolls away from bottom, stop auto-following
          // When they return to bottom, resume auto-following
          // Only update if this is a user-initiated scroll change
          if (atBottom) {
            setFollowOutput('smooth');
            isUserScrollingRef.current = false;
          } else if (!isUserScrollingRef.current) {
            // User scrolled up - remember this
            isUserScrollingRef.current = true;
            setFollowOutput(false);
          }
        }}
        isScrolling={(scrolling) => {
          // Track when user is actively scrolling
          if (scrolling && !followOutput) {
            isUserScrollingRef.current = true;
          }
        }}
      />
    </div>
  );
};

export default MessageList;
