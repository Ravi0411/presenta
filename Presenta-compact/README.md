
## Presenta functional setup

The app now uses a server-side Google Gemini request to create structured slide outlines and a server-side `pptxgenjs` builder to create PowerPoint files. Configure the required secret as `GEMINI_API_KEY` with a Google AI Studio API key. The browser never receives this key.

Run the application with `pnpm install` followed by `pnpm dev`. The main tRPC procedure is `presentation.generatePreview`, and the binary download endpoint is `POST /api/export-pptx`. The export request body must contain `topic`, `theme`, and a `slides` array with `title`, `bullet_points`, and optional `speaker_notes`. The response includes `Content-Disposition: attachment` and the PowerPoint MIME type.

Validation commands are `pnpm check`, `pnpm test`, and `pnpm build`. The test suite covers OAuth logout behavior, Gemini credential authentication, input validation, and PowerPoint payload generation.
