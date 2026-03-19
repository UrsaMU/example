# Jobs — Urban Shadows

Jobs track pending requests between players and staff. They are filed
automatically when you submit a character application, take a major advance, or
when harm or corruption triggers a staff review. You can view, comment on, and
track the status of your jobs here.

## Job Statuses

| Status     | Meaning                                     |
| ---------- | ------------------------------------------- |
| `new`      | Filed, awaiting staff attention             |
| `open`     | Staff has acknowledged and is working on it |
| `resolved` | Approved / completed                        |
| `closed`   | Rejected or closed without resolution       |

## Commands

### +jobs

List your open/active jobs. Staff sees all unresolved jobs.

    +jobs

### +jobs/all [staff]

List every job including resolved and closed ones.

    +jobs/all

### +jobs/view \<#\>

View full details of a job including description and comments.

    +jobs/view 7
    +jobs/view 12

### +jobs/comment \<#\>=\<text\>

Add a comment to a job. Use this to respond to staff questions or provide
additional context.

    +jobs/comment 7=I chose the Spire affiliation because of my backstory.

---

## Staff Commands

### +jobs/approve \<#\>

Mark a job as resolved. Triggers automatic approval hooks for chargen apps and
advance requests.

    +jobs/approve 7

### +jobs/reject \<#\>=\<reason\>

Close a job with a reason. The reason is added as a comment and triggers
automatic rejection hooks for chargen apps.

    +jobs/reject 7=Please add a second debt before submitting.

### +jobs/close \<#\>

Close a job without a specific reason.

    +jobs/close 14

---

## Quick Reference

| What you want to do   | Command                     |
| --------------------- | --------------------------- |
| See my open jobs      | `+jobs`                     |
| See all jobs [staff]  | `+jobs/all`                 |
| View a job's details  | `+jobs/view <#>`            |
| Comment on a job      | `+jobs/comment <#>=<text>`  |
| Approve a job [staff] | `+jobs/approve <#>`         |
| Reject a job [staff]  | `+jobs/reject <#>=<reason>` |
| Close a job [staff]   | `+jobs/close <#>`           |
