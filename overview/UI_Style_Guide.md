Build a web-based game flow node editor designed for puzzle designers.
**Design Philosophy:** "Usability First, Retro-Future Second."
The goal is to create a tool that feels like high-end 1980s industrial equipment (Cassette Futurism/Atompunk) but functions with the smoothness of a modern 2025 SaaS application.

**1. Visual Vibe & Aesthetics:**
* **Theme:** "Soft CRT / Analog Lab Equipment". Imagine a well-calibrated industrial monitor from the late 70s.
* **Background:** Deep, matte charcoal/slate grey (e.g., #18181b or #27272a). Avoid pure black to reduce eye strain.
* **Accents:** High-contrast "Safety Orange" or "Amber" (e.g., #f97316) for active selections, connections, and primary buttons.
* **Borders:** Visible, slightly thicker borders (1px solid #52525b) to define areas clearly. No soft shadows; use solid lines to separate panels.
* **Corners:** Slightly rounded (4px or 6px) to look like machined metal, not fully circular bubble shapes.

**2. Typography (Crucial for Readability):**
* **Primary Font:** Use a highly legible sans-serif with a technical feel, like **Inter** or **Space Grotesk**.
* **Code/Data Font:** Use a robust monospace font like **IBM Plex Mono** or **JetBrains Mono**.
* **Sizing:** Keep text size comfortable (14px base). Avoid pixel fonts or overly stylized retro fonts that are hard to read.
* **Contrast:** Text should be off-white (#e4e4e7) against dark grey. High contrast, but no "bloom" or "glow" effects on text to maintain sharpness.

**3. UI Components & Behavior:**
* **Buttons:** "Chunky" and tactile. When clicked, they should feel mechanical (e.g., push down effect).
* **Panels:** Flat, distinct areas. No glassmorphism (blur). Just solid, reliable opaque colors.
* **Node Graph (React Flow):**
    * Nodes should look like "Data Cartridges" or "Circuit Chips".
    * Connectors (Edges) should be thick, visible wires (Bezier curves).
    * Grid background: A subtle dot matrix or crosshair pattern.

**4. Layout Structure:**
* **Left Sidebar:** "Component Rack" (Draggable nodes list).
* **Center:** The Workspace (Infinite Canvas).
* **Right Sidebar:** "Parameters Deck" (Inspector for editing node properties).
* **Top Bar:** "Control Deck" (Global settings, Export JSON).

**Technical Stack Constraints:**
* Framework: React + Vite + Tailwind CSS.
* Canvas Engine: **React Flow** (Required).
* Icons: **Lucide React** (Stroke width: 2px, for a bolder look).