import { EXCERPT_MAX, SLUG_MAX, TITLE_MAX } from "../lib/limits.js";
import { esc, layout } from "./layout.js";

export const loginPage = (err = "") =>
  layout(
    `<section class="wrap narrow login"><h1 class="hero">Admin</h1>
<form method="post" action="/admin/login" class="stack">
  <input type="password" name="password" placeholder="Password" autocomplete="current-password" autofocus required>
  <input type="password" name="pin" placeholder="8-digit PIN" inputmode="numeric" pattern="[0-9]{8}" minlength="8" maxlength="8" autocomplete="off" required
    title="Your 8-digit PIN" oninput="this.value=this.value.replace(/\D/g,'')">
  ${err ? `<p class="err">${esc(err)}</p>` : ""}
  <button class="btn solid" type="submit">Sign in</button>
</form></section>`,
    { title: "Admin" },
    { noindex: true, bare: true },
  );

export const adminPage = () =>
  layout(
    `<section class="wrap admin">
  <div class="admin-top">
    <h1>Posts</h1>
    <div><button class="btn" id="new">New post</button> <form method="post" action="/admin/logout" style="display:inline"><button class="btn" type="submit">Sign out</button></form></div>
  </div>
  <div class="admin-cols">
    <aside id="list" class="admin-list"></aside>
    <div id="editor" class="editor" hidden>
      <input id="title" placeholder="Title" class="in-title" maxlength="${TITLE_MAX}">
      <div class="counter" id="title-count" aria-live="off"></div>
      <div class="row">
        <input id="slug" placeholder="slug (auto)" maxlength="${SLUG_MAX}">
        <select id="status"><option value="draft">Draft</option><option value="published">Published</option></select>
        <label class="check"><input type="checkbox" id="pinned"> Pin to home</label>
      </div>
      <textarea id="excerpt" rows="2" placeholder="Short excerpt (used on cards + SEO)" maxlength="${EXCERPT_MAX}"></textarea>
      <div class="counter" id="excerpt-count"></div>
      <div class="row"><span class="muted">Cover:</span><span id="cover-label" class="muted">none</span><button class="btn sm" id="cover-clear" type="button">Clear</button></div>
      <div class="row"><label class="check">Title on cover (desktop): <select id="title-pos" title="Where the date and title sit on the cover image on laptops and tablets"><option value="bottom">Bottom left</option><option value="top">Top left</option></select></label><span class="muted hint">Only used when the post has a cover. On phones the title is always above the image.</span></div>
      <div class="toolbar">
        <button type="button" class="btn sm" id="upload">Upload image</button>
        <input type="file" id="file" accept="image/*" multiple hidden>
        <span class="muted">or drag &amp; drop onto the editor</span>
      </div>
      <div class="split">
        <div>
          <textarea id="body" class="md" placeholder="Write Markdown…"></textarea>
        </div>
        <div>
          <div id="preview" class="prose preview"></div>
        </div>
      </div>
      <div id="images" class="thumbs"></div>
      <div id="imgpanel" class="imgpanel" hidden>
        <div class="ip-head"><strong id="ip-title">Insert image</strong><span id="ip-usage" class="muted"></span></div>
        <label>Align <select id="ip-align"><option>center</option><option>left</option><option>right</option><option>full</option></select></label>
        <label>Size <select id="ip-size"><option>lg</option><option>sm</option><option>md</option><option>wide</option><option>full</option></select></label>
        <label>Alt <input id="ip-alt"></label>
        <label>Caption <input id="ip-cap"></label>
        <button class="btn sm solid" id="ip-insert" type="button">Insert at cursor</button>
        <button class="btn sm" id="ip-cover" type="button">Use as cover</button>
        <button class="btn sm del" id="ip-delete" type="button">Delete image</button>
      </div>
      <div class="row"><button class="btn solid" id="save" type="button">Save</button><button class="btn" id="delete" type="button">Delete</button></div>
    </div>
  </div>
</section>`,
    { title: "Admin" },
    { noindex: true, bare: true, script: "/admin.js" },
  );
