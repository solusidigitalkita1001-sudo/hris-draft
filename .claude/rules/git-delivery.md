# Automatic Git delivery

For every task execution that changes tracked repository content:

1. Complete the requested change and run the relevant verification.
2. Review the diff and stage only files that belong to the current task.
3. Commit the verified change with a clear, conventional commit message.
4. Push the commit to the current branch's configured remote before reporting completion.

Never stage or commit unrelated pre-existing changes, untracked user files, credentials, tokens, secrets, or generated artifacts that are not part of the task.

Do not push when verification fails, merge conflicts remain, sensitive data may be included, or the user explicitly asks not to push. Report the blocker instead.

Never force-push, rewrite history, or change branches/remotes unless the user explicitly requests it.
