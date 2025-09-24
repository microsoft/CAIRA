<!-- META
title: Commit Signing Setup
description: Instructions for setting up commit signing for CAIRA contributors.
author: CAIRA Team
ms.date: 09/24/2025
ms.topic: guide
estimated_reading_time: 7
keywords:
    - commit signing
    - CAIRA
    - commits
    - best practices
    - github
-->

# Enabling Commit Signing on GitHub with SSH Keys

By default, Git commits are _not_ signed. This means anyone could push commits that look like they came from somebody else. Enabling commit signing ensures the commits are marked as `Verified` on GitHub, proving they came from the actual author.

This guide walks you through enabling commit signing using SSH keys. SSH signing is a modern and simpler alternative to GPG signing, and it works seamlessly with GitHub.

## Prerequisites

- A GitHub account
- Git installed and configured with a GitHub username and email

## Generate an SSH Key for Signing

Run the following command in the terminal:

```shell
ssh-keygen -t ed25519 -C "<your_email@example.com>"
```

When prompted, press `Enter` to accept the default save location (for example: `~/.ssh/id_ed25519`).

When prompted, enter a passphrase (recommended for security).

This creates two files:

- `~/.ssh/id_ed25519` : Private key (keep safe, do not share)
- `~/.ssh/id_ed25519.pub` : Public key (you’ll add this to GitHub)

![Screenshot of terminal showing ssh-keygen command and output](https://github.com/user-attachments/assets/1b5fc6ab-5436-4c23-a025-be4a30c8a360)

## Add the SSH Public Key to GitHub

Copy the contents of the _public key_ file:

```shell
cat ~/.ssh/id_ed25519.pub
```

In GitHub, go to [Settings](https://github.com/settings/profile) / [SSH and GPG keys](https://github.com/settings/keys) / [New SSH key](https://github.com/settings/ssh/new).

Give it a name (for example: `My Laptop`) and paste the key.

Click `Add SSH key`.

Click `Configure SSO` and authorize the key for the CAIRA organization.

![Authorize SSH Key](https://github.com/user-attachments/assets/19158da7-83df-43ca-b232-4c199fb681c7)

## Configure Git to Use SSH Signing

Run the following commands to enable commit signing globally:

```shell
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true
```

This tells Git to:

- Use SSH instead of GPG for signing
- Sign commits by default

## Make a Signed Commit

Clone the CAIRA repository:

```shell
git clone git@github.com:microsoft/CAIRA.git
cd CAIRA
```

Make a change and commit it:

```shell
echo "Signed commit test" > test.txt
git add test.txt
git commit -S -m "Test signed commit"
git push
```

On GitHub, open the commit in the web UI, you should see "_Verified_".

![Verified commit](https://github.com/user-attachments/assets/753cbca6-6954-4b71-b60a-8a6433454d4f)

## Troubleshooting

If you see "_Unverified_" instead of "_Verified_":

Make sure to use the same email as the GitHub account when generating the key.

The key was added to GitHub under SSH and GPG keys.

Ensure `git config user.email` matches the GitHub email.

Check the git config:

```shell
git config user.email
```

## References

- [GitHub Docs: About commit signature verification](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification)
- [GitHub Docs: Signing commits with SSH keys](https://docs.github.com/en/authentication/managing-commit-signature-verification/signing-commits-with-ssh-keys)
- [Git Docs: Commit signing](https://git-scm.com/book/en/v2/Git-Tools-Signing-Your-Work)
