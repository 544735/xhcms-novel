'use client';

import ImageExtension from '@tiptap/extension-image';
import LinkExtension from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import UnderlineExtension from '@tiptap/extension-underline';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ArticleEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

interface ToolbarButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ToolbarButton({ label, active, disabled, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors',
        'hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
        active && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />;
}

function promptUrl(message: string, initial = ''): string | null {
  if (typeof window === 'undefined') return null;
  const result = window.prompt(message, initial);
  if (result === null) return null;
  const trimmed = result.trim();
  return trimmed.length ? trimmed : '';
}

/** TipTap 富文本编辑器（仅客户端渲染，调用处需 dynamic import + ssr:false） */
export function ArticleEditor({
  value,
  onChange,
  placeholder = '开始撰写正文，支持标题、列表、引用、代码块、链接与图片…',
  className,
}: ArticleEditorProps) {
  const onChangeRef = React.useRef(onChange);

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      UnderlineExtension,
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      ImageExtension.configure({ allowBase64: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'prose-wmcms focus:outline-none',
      },
    },
    onUpdate: ({ editor: current }) => {
      onChangeRef.current(current.getHTML());
    },
  });

  // 外部内容变化（如编辑页异步加载）时同步到编辑器，避免覆盖用户输入
  React.useEffect(() => {
    if (!editor) return;
    if (value === editor.getHTML()) return;
    editor.commands.setContent(value || '', false);
  }, [editor, value]);

  return (
    <div className={cn('wmcms-editor', className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/70 bg-muted/30 px-2 py-1.5">
        <ToolbarButton
          label="撤销"
          disabled={!editor?.can().undo()}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="重做"
          disabled={!editor?.can().redo()}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          label="标题 H2"
          active={editor?.isActive('heading', { level: 2 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="标题 H3"
          active={editor?.isActive('heading', { level: 3 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          label="加粗"
          active={editor?.isActive('bold')}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="斜体"
          active={editor?.isActive('italic')}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="下划线"
          active={editor?.isActive('underline')}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="行内代码"
          active={editor?.isActive('code')}
          onClick={() => editor?.chain().focus().toggleCode().run()}
        >
          <Code2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          label="无序列表"
          active={editor?.isActive('bulletList')}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="有序列表"
          active={editor?.isActive('orderedList')}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="引用"
          active={editor?.isActive('blockquote')}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="代码块"
          active={editor?.isActive('codeBlock')}
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        >
          <Code2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          label="左对齐"
          active={editor?.isActive({ textAlign: 'left' })}
          onClick={() => editor?.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="居中"
          active={editor?.isActive({ textAlign: 'center' })}
          onClick={() => editor?.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="右对齐"
          active={editor?.isActive({ textAlign: 'right' })}
          onClick={() => editor?.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          label="插入链接"
          active={editor?.isActive('link')}
          onClick={() => insertLink(editor)}
        >
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="插入图片" onClick={() => insertImage(editor)}>
          <ImagePlus className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="分隔线"
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <div className="max-w-none px-4 py-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function insertLink(editor: Editor | null) {
  if (!editor) return;
  const previous = (editor.getAttributes('link').href as string | undefined) ?? '';
  const url = promptUrl('请输入链接地址（留空可移除链接）', previous || 'https://');
  if (url === null) return;
  if (!url) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
}

function insertImage(editor: Editor | null) {
  if (!editor) return;
  const url = promptUrl('请输入图片地址', 'https://');
  if (!url) return;
  editor.chain().focus().setImage({ src: url, alt: '' }).run();
}
