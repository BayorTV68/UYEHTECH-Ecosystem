<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9">
<xsl:output method="html" encoding="UTF-8" indent="yes"/>

<xsl:template match="/">
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>XML Sitemap — UYEH TECH</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&amp;family=Montserrat:wght@400;500;600;700&amp;display=swap" rel="stylesheet"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family:'Montserrat',sans-serif;
      background:linear-gradient(135deg,#0a0a0a 0%,#1a1a1a 100%);
      color:#d1d5db;
      padding:60px 20px 100px;
    }
    .wrap { max-width:1000px; margin:0 auto; }
    h1 {
      font-family:'Playfair Display',serif;
      color:#00ff88;
      font-size:2.2em;
      margin-bottom:8px;
      text-shadow:0 0 30px rgba(0,255,136,0.3);
    }
    .subtitle { color:#9ca3af; margin-bottom:10px; }
    .count {
      display:inline-block;
      background:rgba(0,255,136,0.1);
      border:1px solid rgba(0,255,136,0.3);
      color:#00ff88;
      padding:6px 16px;
      border-radius:20px;
      font-size:0.85em;
      font-weight:600;
      margin-bottom:35px;
    }
    table {
      width:100%;
      border-collapse:collapse;
      background:rgba(0,255,136,0.03);
      border:1px solid rgba(0,255,136,0.15);
      border-radius:12px;
      overflow:hidden;
    }
    thead { background:rgba(0,255,136,0.08); }
    th {
      text-align:left;
      padding:14px 18px;
      color:#00ff88;
      font-size:0.8em;
      text-transform:uppercase;
      letter-spacing:1px;
      border-bottom:1px solid rgba(0,255,136,0.2);
    }
    td {
      padding:14px 18px;
      border-bottom:1px solid rgba(255,255,255,0.05);
      font-size:0.92em;
      vertical-align:middle;
    }
    tr:last-child td { border-bottom:none; }
    tr:hover td { background:rgba(0,255,136,0.05); }
    a { color:#d1d5db; text-decoration:none; word-break:break-all; }
    a:hover { color:#00ff88; }
    .prio {
      display:inline-block;
      min-width:36px;
      text-align:center;
      padding:3px 8px;
      border-radius:6px;
      font-weight:700;
      font-size:0.85em;
    }
    .prio-high { background:rgba(0,255,136,0.15); color:#00ff88; }
    .prio-mid  { background:rgba(255,200,0,0.12); color:#ffc800; }
    .prio-low  { background:rgba(255,255,255,0.08); color:#9ca3af; }
    .freq { color:#9ca3af; text-transform:capitalize; }
    footer { margin-top:30px; color:#6b7280; font-size:0.85em; text-align:center; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>🗺️ XML Sitemap</h1>
    <p class="subtitle">Machine-readable sitemap for search engines — you're seeing the styled version.</p>
    <span class="count">
      <xsl:value-of select="count(sm:urlset/sm:url)"/> URLs indexed
    </span>

    <table>
      <thead>
        <tr>
          <th>URL</th>
          <th>Last Modified</th>
          <th>Change Frequency</th>
          <th>Priority</th>
        </tr>
      </thead>
      <tbody>
        <xsl:for-each select="sm:urlset/sm:url">
          <xsl:sort select="sm:priority" order="descending"/>
          <tr>
            <td>
              <a href="{sm:loc}" target="_blank">
                <xsl:value-of select="sm:loc"/>
              </a>
            </td>
            <td><xsl:value-of select="sm:lastmod"/></td>
            <td class="freq"><xsl:value-of select="sm:changefreq"/></td>
            <td>
              <xsl:choose>
                <xsl:when test="sm:priority &gt;= 0.8">
                  <span class="prio prio-high"><xsl:value-of select="sm:priority"/></span>
                </xsl:when>
                <xsl:when test="sm:priority &gt;= 0.5">
                  <span class="prio prio-mid"><xsl:value-of select="sm:priority"/></span>
                </xsl:when>
                <xsl:otherwise>
                  <span class="prio prio-low"><xsl:value-of select="sm:priority"/></span>
                </xsl:otherwise>
              </xsl:choose>
            </td>
          </tr>
        </xsl:for-each>
      </tbody>
    </table>

    <footer>UYEH TECH — generated sitemap.xml, styled via sitemap.xsl</footer>
  </div>
</body>
</html>
</xsl:template>
</xsl:stylesheet>
