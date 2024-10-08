export const OVERLAYS_STATIC = `<html>
  <head>
    <title>{PAGE_URL}</title>
    <link rel="icon" type="image/x-icon" href="/assets/favicon.ico" />
    <link rel="stylesheet" href="/assets/fonts/style.css" />

    <style>
      * {
        padding: 0;
        margin: 0;
        box-sizing: border-box;
        min-width: 0;
      }

      body {
        font-size: 2.5em;
        font-family: "Roboto", sans-serif;
        font-weight: 400;
        color: #c9abae;
        background: #110d0d;
      }

      ul {
        margin: 30px;
        list-style: decimal-leading-zero;
        display: grid;
        grid-template-columns: 25% 25% 25% 25%;
        padding: 0;
        content-visibility: auto;
        contain-intrinsic-size: 1000px;
      }

      li {
        margin-left: 2em;
      }

      a {
        color: #b5616b;
        text-decoration: underline;
        text-underline-offset: 6px;
        transition: 0.2s ease;
        transition-property: text-underline-offset, color;
        overflow-wrap: break-word;
      }

      a:hover {
        color: #c9abae;
        text-underline-offset: 4px;
      }
    </style>
  </head>

  <body>
    <ul id="overlays-list">
      {OVERLAYS_LIST}
    </ul>
  </body>
</html>`;
