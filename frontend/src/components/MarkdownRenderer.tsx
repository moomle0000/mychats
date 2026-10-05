'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Box,
  Typography,
  Link as MuiLink,
  Tooltip,
  IconButton,
} from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';

interface CodeBlockProps {
  language?: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const displayLang = (language || 'code').toUpperCase();

  return (
    <Box
      sx={{
        my: 1.5,
        borderRadius: 2,
        overflow: 'hidden',
        border: 1,
        borderColor: (theme) =>
          theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.15)',
        backgroundColor: '#12141a',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      }}
    >
      {/* Code Header Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 0.5,
          backgroundColor: '#1a1d26',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <CodeRoundedIcon sx={{ fontSize: 15, color: '#94a3b8' }} />
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              fontSize: '0.72rem',
              color: '#94a3b8',
              letterSpacing: '0.05em',
            }}
          >
            {displayLang}
          </Typography>
        </Box>
        <Tooltip title={copied ? 'Copied!' : 'Copy Code'}>
          <IconButton
            size="small"
            onClick={handleCopy}
            sx={{
              p: 0.5,
              color: copied ? '#4ade80' : '#94a3b8',
              '&:hover': {
                color: '#f8fafc',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
              },
            }}
          >
            {copied ? (
              <CheckRoundedIcon sx={{ fontSize: 15 }} />
            ) : (
              <ContentCopyRoundedIcon sx={{ fontSize: 15 }} />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Code Content */}
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          overflowX: 'auto',
          fontFamily: 'Consolas, Monaco, "Courier New", Courier, monospace',
          fontSize: '0.84rem',
          lineHeight: 1.55,
          color: '#e2e8f0',
          backgroundColor: '#12141a',
          '& code': {
            fontFamily: 'inherit',
            fontSize: 'inherit',
          },
        }}
      >
        <code>{code}</code>
      </Box>
    </Box>
  );
}

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <Box
      sx={{
        lineHeight: 1.6,
        fontSize: '0.92rem',
        wordBreak: 'break-word',
        '& > *:first-child': { mt: 0 },
        '& > *:last-child': { mb: 0 },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children }) => (
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: '1.2rem',
                mt: 1.5,
                mb: 0.75,
                color: 'text.primary',
              }}
            >
              {children}
            </Typography>
          ),
          h2: ({ children }) => (
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                fontSize: '1.08rem',
                mt: 1.25,
                mb: 0.5,
                color: 'text.primary',
              }}
            >
              {children}
            </Typography>
          ),
          h3: ({ children }) => (
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                fontSize: '0.98rem',
                mt: 1,
                mb: 0.5,
                color: 'text.primary',
              }}
            >
              {children}
            </Typography>
          ),
          h4: ({ children }) => (
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                fontSize: '0.92rem',
                mt: 0.75,
                mb: 0.25,
                color: 'text.primary',
              }}
            >
              {children}
            </Typography>
          ),

          // Paragraph
          p: ({ children }) => (
            <Typography
              variant="body1"
              component="p"
              sx={{
                my: 0.6,
                fontSize: 'inherit',
                lineHeight: 'inherit',
                color: 'text.primary',
              }}
            >
              {children}
            </Typography>
          ),

          // Pre wrapper bypass (handled by CodeBlock)
          pre: ({ children }) => <>{children}</>,

          // Code
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const rawCode = String(children).replace(/\n$/, '');
            const isMultiline = rawCode.includes('\n') || Boolean(match);

            if (isMultiline) {
              return (
                <CodeBlock
                  language={match ? match[1] : undefined}
                  code={rawCode}
                />
              );
            }

            return (
              <Box
                component="code"
                sx={{
                  px: 0.6,
                  py: 0.2,
                  mx: 0.2,
                  borderRadius: 1,
                  fontFamily: 'Consolas, Monaco, "Courier New", Courier, monospace',
                  fontSize: '0.85em',
                  fontWeight: 500,
                  backgroundColor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.12)'
                      : 'rgba(0, 0, 0, 0.08)',
                  color: (theme) =>
                    theme.palette.mode === 'dark' ? '#cbd5e1' : '#334155',
                  wordBreak: 'break-word',
                  verticalAlign: 'baseline',
                }}
                {...props}
              >
                {children}
              </Box>
            );
          },

          // Blockquote
          blockquote: ({ children }) => (
            <Box
              component="blockquote"
              sx={{
                borderLeft: 3.5,
                borderColor: 'primary.main',
                pl: 1.5,
                my: 1,
                mx: 0,
                color: 'text.secondary',
                fontStyle: 'italic',
                backgroundColor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.04)'
                    : 'rgba(0, 0, 0, 0.03)',
                py: 0.5,
                borderRadius: '0 6px 6px 0',
              }}
            >
              {children}
            </Box>
          ),

          // Lists
          ul: ({ children }) => (
            <Box
              component="ul"
              sx={{
                pl: 2.5,
                my: 0.5,
                '& li': { my: 0.25 },
              }}
            >
              {children}
            </Box>
          ),
          ol: ({ children }) => (
            <Box
              component="ol"
              sx={{
                pl: 2.5,
                my: 0.5,
                '& li': { my: 0.25 },
              }}
            >
              {children}
            </Box>
          ),
          li: ({ children }) => (
            <Typography
              component="li"
              variant="body1"
              sx={{
                fontSize: 'inherit',
                lineHeight: 'inherit',
                color: 'text.primary',
              }}
            >
              {children}
            </Typography>
          ),

          // Links
          a: ({ href, children }) => (
            <MuiLink
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: 'primary.main',
                textDecoration: 'underline',
                wordBreak: 'break-all',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.4,
                fontWeight: 500,
                '&:hover': {
                  opacity: 0.85,
                },
              }}
            >
              <LinkRoundedIcon sx={{ fontSize: 14 }} />
              {children}
            </MuiLink>
          ),

          // Tables (GFM)
          table: ({ children }) => (
            <Box sx={{ overflowX: 'auto', my: 1.5, maxWidth: '100%' }}>
              <Box
                component="table"
                sx={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.86rem',
                  border: 1,
                  borderColor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.15)'
                      : 'rgba(0, 0, 0, 0.12)',
                  borderRadius: 1.5,
                  overflow: 'hidden',
                }}
              >
                {children}
              </Box>
            </Box>
          ),
          thead: ({ children }) => (
            <Box
              component="thead"
              sx={{
                backgroundColor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.05)',
              }}
            >
              {children}
            </Box>
          ),
          tbody: ({ children }) => (
            <Box component="tbody">{children}</Box>
          ),
          tr: ({ children }) => (
            <Box
              component="tr"
              sx={{
                borderBottom: 1,
                borderColor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.06)',
                '&:last-child': { borderBottom: 0 },
              }}
            >
              {children}
            </Box>
          ),
          th: ({ children }) => (
            <Box
              component="th"
              sx={{
                p: 1,
                textAlign: 'left',
                fontWeight: 600,
                borderBottom: 1,
                borderColor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.15)'
                    : 'rgba(0, 0, 0, 0.12)',
              }}
            >
              {children}
            </Box>
          ),
          td: ({ children }) => (
            <Box
              component="td"
              sx={{
                p: 1,
                verticalAlign: 'top',
              }}
            >
              {children}
            </Box>
          ),

          // Horizontal rule
          hr: () => (
            <Box
              component="hr"
              sx={{
                my: 1.5,
                border: 'none',
                borderTop: 1,
                borderColor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.12)'
                    : 'rgba(0, 0, 0, 0.1)',
              }}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
}
