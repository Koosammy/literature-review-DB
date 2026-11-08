
from html import escape
from pathlib import Path
from string import Template


_LETTERHEAD = Template(Path(__file__).with_name("letterhead.html").read_text(encoding="utf-8"))


def render_letterhead(
    *,
    name: str,
    title: str,
    message: str,
    action: str,
    url: str,
    note: str,
    expiry: str = "",
) -> str:
    expiry_cell = ""
    if expiry:
        expiry_cell = (
            '<td style="padding-left:14px;font-size:13px;line-height:19px;'
            f'color:#475b53;">{escape(expiry)}</td>'
        )

    return _LETTERHEAD.substitute(
        name=escape(name),
        title=escape(title),
        message=escape(message),
        action=escape(action),
        url=escape(url),
        note=escape(note),
        expiry_cell=expiry_cell,
    )
