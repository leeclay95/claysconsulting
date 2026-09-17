#!/usr/bin/env python3
"""
Generates the Clay's Consulting penetration testing report template
(.docx). Re-run this after editing to regenerate the .docx from a single
source of truth instead of hand-editing Word XML.

Usage:
    .venv/bin/python build_template.py
"""

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

# --- Brand palette --------------------------------------------------------
# Exact hex values from claysconsulting.org's src/styles/tokens.css, adapted
# for a printable white page: the dark-UI border tones (--border-strong)
# are too dark to use as hairline rules on paper, so table borders use a
# light neutral gray instead. Text, headings, and accent fills keep the
# site's exact crimson/black so the document still reads as the same brand.
BLACK = RGBColor(0x0B, 0x0C, 0x0F)  # --bg
CRIMSON = RGBColor(0xFF, 0x3B, 0x47)  # --accent
CRIMSON_DARK = RGBColor(0xB0, 0x12, 0x1F)  # darker shade for Critical fill
AMBER = RGBColor(0xFF, 0xB2, 0x24)  # --warning
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
TEXT_DIM = RGBColor(0x5A, 0x60, 0x6E)  # --text-dim
BORDER_LIGHT = "D9D9D9"  # print-safe hairline gray, hex string (no #)

RISK_COLORS = {
    "Critical": (CRIMSON_DARK, WHITE),
    "High": (CRIMSON, WHITE),
    "Medium": (AMBER, BLACK),
    "Low": (RGBColor(0xFF, 0xE6, 0x99), BLACK),
    "Informational": (RGBColor(0xD9, 0xD9, 0xD9), BLACK),
}

# For "Vulnerability Level: X" labels on white body text (not table fills):
# amber/light-yellow/gray read poorly as plain text on white, so only
# Critical/High get their own color; everything else is plain bold black.
LEVEL_LABEL_COLOR = {
    "Critical": CRIMSON_DARK,
    "High": CRIMSON,
    "Medium": BLACK,
    "Low": BLACK,
    "Informational": BLACK,
}

FONT_NAME = "Calibri"


# --- Low-level helpers (python-docx has no direct API for these) ----------

def set_cell_background(cell, hex_color: str):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    cell._tc.get_or_add_tcPr().append(shd)


def rgb_to_hex(color: RGBColor) -> str:
    return f"{color[0]:02X}{color[1]:02X}{color[2]:02X}"


def set_table_borders(table, color_hex=BORDER_LIGHT, size=4):
    tbl = table._tbl
    tblPr = tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), str(size))
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), color_hex)
        borders.append(el)
    tblPr.append(borders)


def add_page_number_field(paragraph):
    run = paragraph.add_run()
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), "PAGE")
    run._r.addnext(fld)


def add_toc_field(paragraph):
    """Inserts a real Word TOC field. Word prompts to update it on open;
    it will not render entries until then (this is normal Word behavior,
    not a bug in this file)."""
    run = paragraph.add_run()
    fldChar_begin = OxmlElement("w:fldChar")
    fldChar_begin.set(qn("w:fldCharType"), "begin")
    instrText = OxmlElement("w:instrText")
    instrText.set(qn("xml:space"), "preserve")
    instrText.text = 'TOC \\o "1-3" \\h \\z \\u'
    fldChar_separate = OxmlElement("w:fldChar")
    fldChar_separate.set(qn("w:fldCharType"), "separate")
    placeholder = OxmlElement("w:t")
    placeholder.text = "Right-click and choose Update Field to build the table of contents."
    fldChar_end = OxmlElement("w:fldChar")
    fldChar_end.set(qn("w:fldCharType"), "end")
    r = run._r
    r.append(fldChar_begin)
    r.append(instrText)
    r.append(fldChar_separate)
    r.append(placeholder)
    r.append(fldChar_end)


def set_repeat_header_row(row):
    trPr = row._tr.get_or_add_trPr()
    tblHeader = OxmlElement("w:tblHeader")
    tblHeader.set(qn("w:val"), "true")
    trPr.append(tblHeader)


# --- Document-level styling -------------------------------------------------

def style_document(doc: Document):
    normal = doc.styles["Normal"]
    normal.font.name = FONT_NAME
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = BLACK
    normal.paragraph_format.space_after = Pt(8)

    h1 = doc.styles["Heading 1"]
    h1.font.name = FONT_NAME
    h1.font.size = Pt(16)
    h1.font.bold = True
    h1.font.color.rgb = BLACK
    h1.paragraph_format.space_before = Pt(18)
    h1.paragraph_format.space_after = Pt(8)
    pPr = h1.element.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    left = OxmlElement("w:left")
    left.set(qn("w:val"), "single")
    left.set(qn("w:sz"), "24")
    left.set(qn("w:space"), "6")
    left.set(qn("w:color"), rgb_to_hex(CRIMSON))
    pBdr.append(left)
    pPr.append(pBdr)

    h2 = doc.styles["Heading 2"]
    h2.font.name = FONT_NAME
    h2.font.size = Pt(13)
    h2.font.bold = True
    h2.font.color.rgb = CRIMSON_DARK
    h2.paragraph_format.space_before = Pt(14)

    h3 = doc.styles["Heading 3"]
    h3.font.name = FONT_NAME
    h3.font.size = Pt(11.5)
    h3.font.bold = True
    h3.font.color.rgb = BLACK
    h3.paragraph_format.space_before = Pt(10)

    sections = doc.sections
    for s in sections:
        s.top_margin = Inches(0.9)
        s.bottom_margin = Inches(0.8)
        s.left_margin = Inches(0.9)
        s.right_margin = Inches(0.9)


def add_header_footer(section, classification_placeholder="CONFIDENTIAL"):
    header = section.header
    header.is_linked_to_previous = False
    htbl = header.add_table(rows=1, cols=2, width=Inches(6.6))
    htbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    left_cell, right_cell = htbl.rows[0].cells
    set_cell_background(left_cell, rgb_to_hex(BLACK))
    set_cell_background(right_cell, rgb_to_hex(BLACK))

    p = left_cell.paragraphs[0]
    run = p.add_run("CLAY'S CONSULTING")
    run.font.bold = True
    run.font.size = Pt(10)
    run.font.color.rgb = CRIMSON
    run.font.name = FONT_NAME

    p2 = right_cell.paragraphs[0]
    p2.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run2 = p2.add_run(classification_placeholder)
    run2.font.bold = True
    run2.font.size = Pt(9)
    run2.font.color.rgb = WHITE
    run2.font.name = FONT_NAME

    footer = section.footer
    footer.is_linked_to_previous = False
    fp = footer.paragraphs[0]
    fp.paragraph_format.space_before = Pt(4)
    pPr = fp._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    top = OxmlElement("w:top")
    top.set(qn("w:val"), "single")
    top.set(qn("w:sz"), "8")
    top.set(qn("w:space"), "4")
    top.set(qn("w:color"), rgb_to_hex(CRIMSON))
    pBdr.append(top)
    pPr.append(pBdr)

    run3 = fp.add_run("Clay's Consulting  |  Penetration Testing Report Template  |  Page ")
    run3.font.size = Pt(8)
    run3.font.color.rgb = TEXT_DIM
    add_page_number_field(fp)
    run4 = fp.add_run(" of ")
    run4.font.size = Pt(8)
    run4.font.color.rgb = TEXT_DIM
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), "NUMPAGES")
    fp._p.append(fld)


# --- Content sections --------------------------------------------------

def add_cover_page(doc: Document):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    run = p.add_run("CLAY'S CONSULTING")
    run.font.size = Pt(20)
    run.font.bold = True
    run.font.color.rgb = CRIMSON
    run.font.name = FONT_NAME

    rule = doc.add_paragraph()
    rule.paragraph_format.space_after = Pt(0)
    pPr = rule._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "24")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), rgb_to_hex(BLACK))
    pBdr.append(bottom)
    pPr.append(pBdr)

    for _ in range(3):
        doc.add_paragraph()

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r = title.add_run("Penetration Testing Report")
    r.font.size = Pt(30)
    r.font.bold = True
    r.font.color.rgb = BLACK

    subtitle = doc.add_paragraph()
    r = subtitle.add_run("[Client / Organization Name]")
    r.font.size = Pt(16)
    r.font.color.rgb = TEXT_DIM
    r.italic = True

    subtitle2 = doc.add_paragraph()
    r = subtitle2.add_run("[Engagement Name or Scope Summary]")
    r.font.size = Pt(13)
    r.font.color.rgb = TEXT_DIM
    r.italic = True

    doc.add_paragraph()

    meta = doc.add_paragraph()
    r = meta.add_run("Delivery Date: ")
    r.font.bold = True
    r2 = meta.add_run("[Insert Date]")
    meta2 = doc.add_paragraph()
    r = meta2.add_run("Classification: ")
    r.font.bold = True
    r2 = meta2.add_run("[Confidential / CUI / Unclassified – select one]")
    r2.font.color.rgb = CRIMSON_DARK
    r2.font.bold = True

    for _ in range(2):
        doc.add_paragraph()

    to_heading = doc.add_paragraph()
    r = to_heading.add_run("Prepared For:")
    r.font.bold = True
    for line in ("[Point of Contact Name]", "[Title]", "[Client Organization]",
                 "Phone: [Phone Number]", "Email: [email@address.com]"):
        doc.add_paragraph(line)

    doc.add_paragraph()

    by_heading = doc.add_paragraph()
    r = by_heading.add_run("Prepared By:")
    r.font.bold = True
    for line in ("Lee Clayton", "Clay's Consulting",
                 "Phone: 469-429-2267", "Email: info@claysconsulting.org"):
        doc.add_paragraph(line)

    doc.add_page_break()


def add_toc_page(doc: Document):
    doc.add_heading("Table of Contents", level=1)
    p = doc.add_paragraph()
    add_toc_field(p)
    doc.add_page_break()


def add_two_col_table(doc, headers, rows, col_widths=None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(table)
    hdr_cells = table.rows[0].cells
    set_repeat_header_row(table.rows[0])
    for i, h in enumerate(headers):
        set_cell_background(hdr_cells[i], rgb_to_hex(BLACK))
        p = hdr_cells[i].paragraphs[0]
        r = p.add_run(h)
        r.font.bold = True
        r.font.color.rgb = WHITE
        r.font.size = Pt(9.5)
    for row in rows:
        cells = table.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = str(val)
            for run in cells[i].paragraphs[0].runs:
                run.font.size = Pt(9.5)
    if col_widths:
        for row in table.rows:
            for i, w in enumerate(col_widths):
                row.cells[i].width = w
    doc.add_paragraph()
    return table


def add_poc_section(doc: Document):
    doc.add_heading("Engagement Points of Contact", level=1)

    doc.add_heading("Client Team:", level=3)
    add_two_col_table(
        doc,
        ["Name", "Title", "Email"],
        [
            ["[Name]", "[Title]", "[email@address.com]"],
            ["[Name]", "[Title]", "[email@address.com]"],
        ],
    )

    doc.add_heading("Clay's Consulting Team:", level=3)
    add_two_col_table(
        doc,
        ["Name", "Title", "Email"],
        [
            ["Lee Clayton", "Engagement Lead", "info@claysconsulting.org"],
            ["[Tester Name]", "Penetration Tester", "[email@claysconsulting.org]"],
        ],
    )
    doc.add_page_break()


def add_introduction(doc: Document):
    doc.add_heading("1.0 Introduction and Objectives", level=1)
    doc.add_paragraph(
        "At the request of [Client Organization], Clay's Consulting performed a "
        "penetration test of [system, application, or network in scope] to "
        "identify potential security vulnerabilities and assess the "
        "organization's security posture."
    )
    for obj in (
        "Objective I – [State the primary engagement objective.]",
        "Objective II – [State any secondary objectives, e.g. compliance "
        "validation, control effectiveness.]",
    ):
        doc.add_paragraph(obj, style="List Bullet")
    doc.add_paragraph(
        "This test was conducted to identify gaps and vulnerabilities that "
        "could result in unnecessary risk to the target environment. Upon "
        "completing testing, Clay's Consulting prioritized identified "
        "vulnerabilities according to their impact on overall security and "
        "included industry-standard recommendations."
    )

    doc.add_heading("1.1 Engagement Scope", level=2)
    doc.add_paragraph(
        "Clay's Consulting testers conducted this engagement [on-site / "
        "remote] from [location]. Testing focused on [summary of the "
        "environment under test]."
    )
    doc.add_paragraph("In Scope:", style="Heading 3")
    for line in ("[Target 1 – IP range, hostname, or application URL]",
                 "[Target 2]"):
        doc.add_paragraph(line, style="List Bullet")
    doc.add_paragraph("Out of Scope:", style="Heading 3")
    for line in ("[Explicitly excluded systems or test types, e.g. denial of service]",):
        doc.add_paragraph(line, style="List Bullet")

    doc.add_heading("1.2 Penetration Testing Methodology", level=2)
    doc.add_paragraph("The Clay's Consulting testing methodology is based on the following phases:")
    add_two_col_table(
        doc,
        ["Phase", "Description"],
        [
            ["Recon", "Searching for open-source information about the target. All "
                      "information potentially useful to an attacker is collected, "
                      "e.g. technology versions, technical documentation, and "
                      "component information."],
            ["Mapping", "Listing all functionalities and/or critical components of "
                        "the target so testers have visibility into the most "
                        "crucial and exposed elements before testing begins."],
            ["Discovery", "The attack phase: testers look for vulnerabilities "
                          "through manual analysis complemented by automated "
                          "tooling, aiming to discover as many vulnerabilities as "
                          "possible."],
            ["Exploitation", "Testing possible exploitation of flaws identified in "
                              "the discovery phase, including using flaws as "
                              "pivots to discover further vulnerabilities and "
                              "evaluate real-world impact."],
        ],
        col_widths=[Inches(1.3), Inches(5.3)],
    )

    doc.add_heading("1.3 Risk Rating Methodology", level=2)
    doc.add_paragraph(
        "Clay's Consulting assigns an overall risk rating based on the Common "
        "Vulnerability Scoring System (CVSS), an open framework for "
        "communicating the characteristics and severity of vulnerabilities. "
        "CVSS scores are presented on a 0–10 scale, alongside a vector "
        "string, a compressed textual representation of the values used to "
        "derive the score."
    )
    add_two_col_table(
        doc,
        ["CVSS v4.0 Score", "Overall Risk Level"],
        [
            ["9.0 – 10.0", "Critical"],
            ["7.0 – 8.9", "High"],
            ["4.0 – 6.9", "Medium"],
            ["0.1 – 3.9", "Low"],
            ["0.0 / N/A", "Informational"],
        ],
        col_widths=[Inches(2.5), Inches(2.5)],
    )
    doc.add_page_break()


def add_executive_summary(doc: Document):
    doc.add_heading("2.0 Executive Summary", level=1)
    doc.add_heading("2.1 Overview", level=2)
    doc.add_paragraph(
        "This assessment encompassed a penetration test of [system/application/"
        "network] for [Client Organization]. Testing was conducted [remotely / "
        "on-site] between [start date] and [end date]. The following section "
        "summarizes the vulnerabilities identified, categorized by severity: "
        "Critical, High, Medium, Low, and Informational."
    )

    doc.add_heading("2.2 Findings Outline", level=2)
    table = add_two_col_table(
        doc,
        ["Risk Rating", "Count"],
        [
            ["Critical", "[#]"],
            ["High", "[#]"],
            ["Medium", "[#]"],
            ["Low", "[#]"],
            ["Informational", "[#]"],
        ],
        col_widths=[Inches(2.5), Inches(1)],
    )
    for i, level in enumerate(("Critical", "High", "Medium", "Low", "Informational"), start=1):
        fill, text_color = RISK_COLORS[level]
        cell = table.rows[i].cells[0]
        set_cell_background(cell, rgb_to_hex(fill))
        for run in cell.paragraphs[0].runs:
            run.font.color.rgb = text_color
            run.font.bold = True

    add_two_col_table(
        doc,
        ["Risk Rating", "Finding", "Summary Description"],
        [
            ["Critical", "3.1 [Finding Title]", "[Finding summary.]"],
            ["High", "3.2 [Finding Title]", "[Finding summary.]"],
            ["Medium", "3.3 [Finding Title]", "[Finding summary.]"],
            ["Low", "3.4 [Finding Title]", "[Finding summary.]"],
        ],
        col_widths=[Inches(1), Inches(2), Inches(3.6)],
    )

    doc.add_heading("2.3 Conclusion", level=2)
    doc.add_paragraph(
        "[EXAMPLE – DELETE AND WRITE YOUR OWN] Summarize the overall "
        "security posture observed during this engagement and any "
        "cross-cutting themes across findings."
    )
    doc.add_paragraph(
        "Clay's Consulting advises that Critical and High-level "
        "vulnerabilities be remediated with immediate effect, and that "
        "Medium and Low-level vulnerabilities be addressed within a "
        "timeframe of 30 to 90 days."
    )
    doc.add_page_break()


def add_cvss_table(doc, score, exploitability, risk_level, vector):
    table = doc.add_table(rows=2, cols=3)
    set_table_borders(table)
    headers = ["CVSS v4.0 Score", "Exploitability", "Overall Risk Level"]
    for i, h in enumerate(headers):
        cell = table.rows[0].cells[i]
        set_cell_background(cell, rgb_to_hex(BLACK))
        r = cell.paragraphs[0].add_run(h)
        r.font.bold = True
        r.font.color.rgb = WHITE
        r.font.size = Pt(9.5)
    values = [score, exploitability, risk_level]
    for i, v in enumerate(values):
        cell = table.rows[1].cells[i]
        r = cell.paragraphs[0].add_run(str(v))
        r.font.size = Pt(9.5)
        if i == 2:
            fill, text_color = RISK_COLORS.get(risk_level, (RGBColor(0xD9, 0xD9, 0xD9), BLACK))
            set_cell_background(cell, rgb_to_hex(fill))
            r.font.bold = True
            r.font.color.rgb = text_color

    vec_table = doc.add_table(rows=2, cols=1)
    set_table_borders(vec_table)
    hcell = vec_table.rows[0].cells[0]
    set_cell_background(hcell, rgb_to_hex(BLACK))
    r = hcell.paragraphs[0].add_run("CVSS v4.0 Vector")
    r.font.bold = True
    r.font.color.rgb = WHITE
    r.font.size = Pt(9.5)
    hcell.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
    vcell = vec_table.rows[1].cells[0]
    r = vcell.paragraphs[0].add_run(vector)
    r.font.size = Pt(9.5)
    vcell.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph()


def add_finding(doc, number, title, level, description, evidence_note,
                 recommendation, cvss=None, worked_example=False):
    doc.add_heading(f"{number} {title}", level=2)
    p = doc.add_paragraph()
    r = p.add_run("Vulnerability Level: ")
    r.font.bold = True
    r2 = p.add_run(level)
    r2.font.bold = True
    r2.font.color.rgb = LEVEL_LABEL_COLOR.get(level, BLACK)

    doc.add_heading("Description:", level=3)
    tag = "EXAMPLE – DELETE AND WRITE YOUR OWN" if worked_example else "[Delete and write your own]"
    p = doc.add_paragraph()
    r = p.add_run(tag + "  ")
    r.font.bold = True
    r.font.underline = True
    r.font.size = Pt(9)
    p.add_run(description)

    if cvss:
        add_cvss_table(doc, *cvss)

    doc.add_heading("Evidence:", level=3)
    p = doc.add_paragraph()
    r = p.add_run(evidence_note)
    r.italic = True
    r.font.color.rgb = TEXT_DIM

    doc.add_heading("Recommendations:", level=3)
    p = doc.add_paragraph()
    r = p.add_run(tag + "  ")
    r.font.bold = True
    r.font.underline = True
    r.font.size = Pt(9)
    p.add_run(recommendation)
    doc.add_paragraph()


def add_findings(doc: Document):
    doc.add_heading("3.0 Findings", level=1)
    doc.add_paragraph(
        "This section details the vulnerabilities identified during "
        "testing. Each finding includes a description of its nature and "
        "impact, a CVSS score, supporting evidence where applicable, and "
        "remediation recommendations. The first finding below is a fully "
        "worked example; the remaining findings are skeletons to fill in "
        "for each engagement."
    )

    add_finding(
        doc, "3.1", "Weak Administrative Credentials", "Critical",
        "The administrative web interface for [system name] was found to "
        "accept weak or default credentials (e.g. admin:admin), providing "
        "full administrative access to [describe access gained]. This is "
        "critical because it exposes [describe impact – data, "
        "configuration, downstream systems].",
        "[Insert screenshot or command output demonstrating the finding.]",
        "Enforce a strong password policy for all administrative accounts, "
        "disable or change default credentials before deployment, and "
        "consider multi-factor authentication for administrative access.",
        cvss=("9.4", "High", "Critical",
              "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:H/SI:H/SA:H"),
        worked_example=True,
    )
    add_finding(
        doc, "3.2", "[High Finding Title]", "High",
        "[Delete and write your own description of the vulnerability, its "
        "location, and its impact.]",
        "[Insert screenshot or supporting evidence here.]",
        "[Delete and write your own remediation guidance.]",
        cvss=("[score]", "[Low/Medium/High]", "High", "[CVSS:4.0/... vector]"),
    )
    add_finding(
        doc, "3.3", "[Medium Finding Title]", "Medium",
        "[Delete and write your own description of the vulnerability, its "
        "location, and its impact.]",
        "[Insert screenshot or supporting evidence here.]",
        "[Delete and write your own remediation guidance.]",
        cvss=("[score]", "[Low/Medium/High]", "Medium", "[CVSS:4.0/... vector]"),
    )
    add_finding(
        doc, "3.4", "[Low Finding Title]", "Low",
        "[Delete and write your own description of the vulnerability, its "
        "location, and its impact.]",
        "[Insert screenshot or supporting evidence here.]",
        "[Delete and write your own remediation guidance.]",
        cvss=("[score]", "[Low/Medium/High]", "Low", "[CVSS:4.0/... vector]"),
    )
    doc.add_page_break()


def add_appendix(doc: Document):
    doc.add_heading("4.0 Appendix A", level=1)
    doc.add_heading("Reference Materials", level=2)
    add_two_col_table(
        doc,
        ["Reference", "Link"],
        [
            ["CVSS 4.0 Calculator", "https://www.first.org/cvss/calculator/4.0"],
            ["OWASP Testing Guide", "https://owasp.org/www-project-web-security-testing-guide/"],
            ["NIST SP 800-115", "https://csrc.nist.gov/pubs/sp/800/115/final"],
        ],
        col_widths=[Inches(2.5), Inches(4)],
    )


def main():
    doc = Document()
    style_document(doc)
    add_header_footer(doc.sections[0])
    # Cover page reads as a title page, not a content page: no running
    # black bar or footer rule competing with the title block.
    doc.sections[0].different_first_page_header_footer = True

    add_cover_page(doc)
    add_toc_page(doc)
    add_poc_section(doc)
    add_introduction(doc)
    add_executive_summary(doc)
    add_findings(doc)
    add_appendix(doc)

    out_path = "Clays-Consulting-Pentest-Report-Template.docx"
    doc.save(out_path)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
