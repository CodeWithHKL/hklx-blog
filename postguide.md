# Post guide

How to write a post in the admin (`/admin`). Posts are written in **Markdown**: plain text with a few symbols for formatting. The right-hand **live preview** shows exactly how it will look, so try things and watch it change.

---

## 1. The basics

**Paragraphs:** leave a **blank line** between them.

```
This is paragraph one.

This is paragraph two.
```

**A single Enter does not make a new line.** The two lines join into one paragraph:

```
Line one.
Line two.        <- shows on the same line as "Line one."
```

**A new line without a gap** (addresses, poems): end the line with a backslash `\`, or with two spaces. The backslash is easier because trailing spaces are invisible.

```
123 Main Street\
Springfield\
USA
```

---

## 2. Quick cheat sheet

| You type | You get |
|---|---|
| `## Heading` | section heading |
| `### Smaller heading` | sub-heading |
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `~~crossed out~~` | ~~crossed out~~ |
| `[link text](https://example.com)` | clickable link |
| `> quote` | indented quote with a blue bar |
| `` `code` `` | `inline code` |
| `---` (own line) | divider line |
| `- item` | bullet list |
| `1. item` | numbered list |

---

## 3. Headings

```
## Main section
### Sub-section
```

- Use `##` and `###`. **Don't use a single `#`**: the post title is already the big top heading.
- Put a blank line before and after a heading.

---

## 4. Bold, italic, crossed out

```
This is **bold**, this is *italic*, this is ***both***, and this is ~~crossed out~~.
```

Don't leave a space just inside the symbols: `**bold**` works, `** bold **` doesn't.

---

## 5. Links

```
Read the [official docs](https://example.com).
Email me at [hello](mailto:me@example.com).
```

- Only `https://`, `http://` and `mailto:` links work. Other kinds are removed when you save.
- Links to other websites open normally and are marked safe (`noopener noreferrer`).

---

## 6. Lists

Leave a blank line before the list. No blank lines between items.

```
- first item
- second item
- third item

1. step one
2. step two
3. step three
```

Indent with **two spaces** to nest:

```
- fruit
  - apple
  - banana
- vegetables
```

---

## 7. Quotes

```
> A good paragraph is its own illustration.
```

---

## 8. Code

**Inline:** wrap in single backticks: `` `npm install` ``

**A block:** three backticks on the line before and after. Add the language name after the first set if you like.

````
```js
console.log("hello");
```
````

---

## 9. Tables

```
| Name | Role   |
|------|--------|
| Ana  | Dev    |
| Ben  | Design |
```

The line of dashes under the header row is required.

---

## 10. Divider

A line with just three dashes, with a blank line above it:

```
---
```

---

## 11. Showing a symbol literally

Put a backslash in front of it:

```
\*this is not italic\*
```

---

## 12. Images

**Don't type image code by hand.** Use the image tools under the editor:

1. Click **Upload image** (or drag a file onto the Markdown box).
2. The image appears in the thumbnail strip and the image panel opens.
3. Choose **Align**, **Size**, and optionally **Alt** text and a **Caption**.
4. Click **Insert at cursor**. It goes where your text cursor was last.

Uploading alone does **not** add the image to the post. You must click **Insert at cursor**.

### What the inserted line means

```
![alt text](img:7){align=left size=md caption="Nice view"}
```

Edit this line to change the position later. It must be **on its own line**, with blank lines around it.

| Option | Values | Notes |
|---|---|---|
| `align` | `center` (default), `left`, `right`, `full` | `left`/`right` let text wrap around the image |
| `size` | `sm` (30%), `md` (50%), `lg` (100%, default), `wide`, `full` | `wide` is wider than the text column |
| `caption` | `caption="text"` | shown under the image. Don't use double quotes inside it |

- `alt text` (in the square brackets) describes the picture for screen readers and search engines. Don't put `[` or `]` in it.
- On phones, left/right images become full-width.

### Side-by-side gallery

Put several image lines **right after each other with no blank line between them**:

```
![a](img:1)
![b](img:2)
![c](img:3)
```

They show as a grid. Their `align` and `size` are ignored in a gallery.

### Cover image

Select an image and click **Use as cover**, then **Save**. The cover shows on the home-page card and at the top of the post, cropped to a wide 2:1 shape. The picture in the body is never cropped.

### Deleting an image

Select it and click **Delete image**. The dialog tells you which posts use it. Posts lose the picture automatically. This can't be undone.

---

## 13. The fields around the post

| Field | Limit | Notes |
|---|---|---|
| **Title** | 90 characters | required |
| **Slug** | 80 characters | the URL part. Leave blank to make it from the title. Lowercase letters, numbers and dashes only |
| **Status** | Draft / Published | only **Published** posts are visible to visitors |
| **Excerpt** | 160 characters | short description. **Write one:** it appears on the cards, in search results and in link previews. If it's blank, those are blank |
| **Cover** | optional | see above |
| **Title on cover** | Bottom left / Top left | where the date and title sit on the cover image on laptops and tablets. Default is bottom left. On phones the title is always above the image |
| **Pin to home** | checkbox | shows the post under the big "Latest" card (up to 4 pinned posts) |

A post only needs a **title** to be saved. The body, excerpt and cover are optional.

---

## 14. How the home page shows posts

- The **newest** published post is the big "Latest" card.
- **Pinned** posts sit just under it, with a pin icon.
- The rest appear in a grid, 12 per page, with page numbers underneath.
- Visitors can search by title, excerpt and body text.

---

## 15. Before you publish: checklist

- [ ] Title is clear and under 90 characters
- [ ] Excerpt written (under 160 characters)
- [ ] Headings use `##` / `###`
- [ ] Blank lines between paragraphs, lists and headings
- [ ] Images inserted with **Insert at cursor** and checked in the preview
- [ ] Cover chosen (optional)
- [ ] Status set to **Published**, then **Save**
- [ ] Open the post on the site and read it once

If you leave the page with unsaved changes, the admin asks before throwing them away.

---

## 16. What gets removed

For safety, the blog cleans every post when you save it. Scripts, unknown HTML tags and unsafe links are removed. Stick to Markdown and the image tools above and you'll never notice.
