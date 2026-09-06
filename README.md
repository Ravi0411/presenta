# presenta
Start with the idea. Finish with a deck worth sharing.

Presenta is an AI-powered presentation studio that turns a rough topic into a clear, editable, and presentation-ready slide deck. Users enter a subject, choose the slide count and visual direction, generate a structured outline with Google Gemini, refine the slides in a live viewer, customize the visual system, and download the finished presentation as a PowerPoint file.

Why Presenta

Building a strong presentation is more than placing text on slides. Presenta helps users move from an early idea to a coherent narrative while keeping editorial control in their hands. The result is a reviewable deck that can be edited, branded, saved, and exported without leaving the workspace.

Core capabilities

Capability
Description
AI generation
Creates a structured slide outline from a topic, slide count, and visual direction.
Live slide viewer
Shows generated slides as a real presentation canvas with thumbnail navigation.
Slide editing
Edit titles and bullet points, add new slides, or remove slides while maintaining a safe three-slide minimum.
Visual customization
Change theme, accent color, font pairing, content density, and footer branding.
PowerPoint export
Builds and downloads a real .pptx file using the selected content and visual settings.
Draft persistence
Keeps unsaved work in browser storage so a draft can survive a refresh.
Saved workspace
Authenticated users can save, load, update, list, and delete their presentations.
Resilient error handling
Validates deck data and provides clear feedback for invalid requests and Gemini rate limits.

Product flow

1.Enter the subject that the presentation should make clear.

2.Select the number of slides and the visual direction.

3.Generate the presentation outline with AI.

4.Review the deck in the live slide viewer.

5.Edit, add, or remove slides as needed.

6.Customize the theme, accent, fonts, density, and footer label.

7.Save the presentation to the authenticated workspace or keep it as a local draft.

8.Download the finished PowerPoint file.

Technology

Layer
Technology
Frontend
React, TypeScript, Vite, Tailwind CSS, and responsive CSS
Application server
Node.js, Express, and tRPC
AI generation
Server-side Google Gemini API integration
Persistence
MySQL/TiDB through Drizzle ORM
Authentication
Manus OAuth with authenticated tRPC procedures
PowerPoint generation
pptxgenjs with validated theme and slide data
Validation
Zod schemas shared by generation and export routes
Testing
Vitest, TypeScript checks, and production builds

Architecture

The browser communicates with the server through typed tRPC procedures. The Gemini API key is used only on the server, never exposed to the browser. Generated slide data is validated before it reaches the preview or PowerPoint builder. Authenticated presentation records are scoped to the signed-in user, while public visitors can still generate and export presentations without saving them.

The direct binary export route is available at POST /api/export-pptx. It validates the request, builds the PowerPoint file on the server, and returns it with the correct attachment headers and MIME type.

Local setup

Install the dependencies and start the development server:

Bash
pnpm install
pnpm dev
Run the project checks:
Bash
pnpm check
pnpm test
pnpm build

The application requires a server-side GEMINI_API_KEY from Google AI Studio for real AI generation. Do not commit API keys or .env files to GitHub. Authentication and database environment variables should be configured through the deployment environment.

Repository structure

Plain Text

client/      React interface, pages, styling, and authentication hooks
server/      Express server, tRPC procedures, Gemini integration, persistence, and export
shared/      Shared types and application constants
drizzle/     Database schema and migration files
vite.config.ts
package.json
README.md
GitHub upload

Extract the project archive before uploading it. The repository root should contain package.json, client, server, shared, drizzle, README.md, and the TypeScript/Vite configuration files. On GitHub, open the repository, choose Add file → Upload files, upload the extracted contents, and commit them to the main branch.

Security notes

The Gemini credential must remain server-side. User-owned saved presentations are accessed through authenticated procedures that verify ownership before loading, updating, or deleting records. The export endpoint validates its input before building a PowerPoint file, and the application provides explicit feedback when the AI provider is temporarily rate-limited.

Status

Presenta is a working full-stack presentation generator with AI outline creation, live slide previews, customization, authenticated saved workspaces, browser-local drafts, and PowerPoint export.

References

[1] React documentation
[2] Vite documentation
[3] tRPC documentation
[4] Drizzle ORM documentation
[5] Google Gemini API documentation
[6] PptxGenJS repository
