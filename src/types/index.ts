export type ProjectSection = {
  heading: string;
  items: string[];
};

export type Project = {
  slug: string;
  name: string;
  tagline: string;
  summary: string;
  description: string[];
  sections?: ProjectSection[];
  stack: string[];
  repoUrl?: string;
};
