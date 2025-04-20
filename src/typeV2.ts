type BlockBase = {
  id?: string;
  title?: string;
};

type ContentBase = BlockBase & {
  locale?: string;
};
// content
export type TextBlock = ContentBase & {
  type: "text";
  text: string[];
};

export type ChatBlock = ContentBase & {
  type: "chat";
  text: string[];
  speaker: string;
};

export type MDBlock = ContentBase & {
  type: "markdown";
  markdown: string[];
};

export type LatexBlock = ContentBase & {
  type: "latex";
  latex: string[];
};

export type ImageBlock = ContentBase & {
  type: "image";
  src: string;
  caption?: string[];
};

// The following are proposals that have not yet been implemented
/*

export type CodeBlock = ContentBase & {
  type: "code";
  language?: string;
  code: string[];
};

export type QuoteBlock = ContentBase & {
  type: "quote";
  text: string[];
  source?: string;
};

export type ListBlock = ContentBase & {
  type: "list";
  items: string[];
  ordered?: boolean;
};

export type TableBlock = ContentBase & {
  type: "table";
  headers: string[];
  rows: string[][];
};

export type AudioBlock = ContentBase & {
  type: "audio";
  src: string;
  transcript?: string[];
};

export type VideoBlock = ContentBase & {
  type: "video";
  src: string;
  caption?: string[];
};

export type EmbedBlock = ContentBase & {
  type: "embed";
  url: string;
  provider?: "youtube" | "twitter" | "slideshare" | string;
  title?: string;
};
*/
// end of proposals

// export type ContentData = TextBlock | MDBlock | ChatBlock | ImageBlock | CodeBlock | QuoteBlock | ListBlock | TableBlock | AudioBlock | VideoBlock | EmbedBlock;
export type ContentData = TextBlock | MDBlock | ChatBlock;

export type ContentGroup = BlockBase & {
  type: "group";
  children: ContentNode[];
};

export type ContentNode = ContentData | ContentGroup;

export type MulmoData = {
  type: "mulmo";
  children: ContentNode[];
};
