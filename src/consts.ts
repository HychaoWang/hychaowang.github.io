import type { Site, Metadata, Socials } from "@types";

export const SITE: Site = {
  NAME: "Haichao Wang",
  EMAIL: "hychaowang@outlook.com",
  NUM_POSTS_ON_HOMEPAGE: 4,
  NUM_WORKS_ON_HOMEPAGE: 3,
  NUM_PROJECTS_ON_HOMEPAGE: 4,
};

export const HOME: Metadata = {
  TITLE: "Home",
  DESCRIPTION: "Personal website of Haichao Wang, a master student at Tsinghua University.",
};

export const BLOG: Metadata = {
  TITLE: "Blog",
  DESCRIPTION: "Research notes and technical articles by Haichao Wang.",
};

export const WORK: Metadata = {
  TITLE: "Research",
  DESCRIPTION: "Research experience and academic background.",
};

export const PROJECTS: Metadata = {
  TITLE: "Publications",
  DESCRIPTION: "Selected publications by Haichao Wang.",
};

export const SOCIALS: Socials = [
  { 
    NAME: "github",
    HREF: "https://github.com/HychaoWang"
  },
  { 
    NAME: "google scholar",
    HREF: "https://scholar.google.com/citations?user=-exqY3gAAAAJ&hl=en",
  }
];
