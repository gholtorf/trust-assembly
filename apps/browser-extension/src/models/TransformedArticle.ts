// this should probably just be an Article
export type TransformedArticle = {
  originalHeadline: string;
  transformedHeadline: string;
  providerUsed: string;
  url: string;
  authors: [string];
  published: [Date];
  articleOrigionalContents: string;
  articleTransformedContents: string;
};
