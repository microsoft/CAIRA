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

# Enabling Commit Signing on GitHub

If you're using GitHub CodeSpaces or GitHub.dev, you don't need to set up commit signing as it's pre-configured. However, if working in a local development environment, follow the steps below to enable commit signing for the Git commits.

By default, Git commits are _not_ signed. This means anyone could push commits that look like they came from somebody else. Enabling commit signing ensures the commits are marked as `Verified` on GitHub, proving they came from the actual author.

GitHub supports two methods for signing commits: SSH keys and GPG keys. This document covers both options to choose the method that works best for your development environment.

## Signing Methods

### SSH Keys (Recommended)

- Simpler setup process
- Uses the same keys for authentication and signing
- Ideal for most developers

### GPG Keys

- Traditional method for commit signing
- More complex setup but offers additional features
- Supports key expiration and revocation

## Prerequisites

- A GitHub account
- Git installed and configured with a GitHub username and email

## Configure SSH Key

Either follow the steps to generate a new SSH key

<details>
<summary>Generate a new SSH key</summary>

Run the following command in the terminal to generate a new SSH key (replace `<your_email@example.com>` with your actual email):

```shell
ssh-keygen -t ed25519 -C "<your_email@example.com>"
```

When prompted, press `Enter` to accept the default save location (for example: `~/.ssh/id_ed25519`).

When prompted, enter a passphrase (recommended for security).

This creates two files:

- `~/.ssh/id_ed25519` : Private key (keep safe, do not share)
- `~/.ssh/id_ed25519.pub` : Public key (you’ll add this to GitHub)

![Screenshot of terminal showing ssh-keygen command and output](https://github.com/user-attachments/assets/1b5fc6ab-5436-4c23-a025-be4a30c8a360)
</details>

or follow the steps to use an existing one.

<details>
<summary>Use an existing SSH key</summary>

If you already have an SSH key, you can skip the generation step. Just ensure you know the location of the private and public key files (commonly `~/.ssh/id_ed25519` and `~/.ssh/id_ed25519.pub`).

_Option 1 (Copy existing key files)_

> You may need to copy the existing key files from your host machine to the development environment.

Run the following command to add an existing SSH private key to the SSH agent:

```shell
ssh-add ~/.ssh/id_ed25519
```

_Option 2 (Use the contents of the public key)_

Get the contents of your existing public key file:

```shell
cat ~/.ssh/id_ed25519.pub
```

Configure _git_ to use the existing public key for signing:

```shell
git config --global user.signingkey "key::ssh-ed25519 AAAA... your_email@example.com"
```

</details>

### Add the SSH Public Key to GitHub

Copy the contents of the _public key_ file:

```shell
cat ~/.ssh/id_ed25519.pub
```

In GitHub, go to [Settings](https://github.com/settings/profile) / [SSH and GPG keys](https://github.com/settings/keys) / [New SSH key](https://github.com/settings/ssh/new).

Give it a name (for example: `My Laptop`) and paste the key.

Click `Add SSH key`.

<details>
<summary>Configure SSO for Microsoft employees</summary>

Click `Configure SSO` and authorize the key for the CAIRA organization.

![Authorize SSH Key](https://github.com/user-attachments/assets/19158da7-83df-43ca-b232-4c199fb681c7)

</details>

### Configure Git to Use SSH Signing

Run the following commands to enable commit signing globally:

```shell
git config --global gpg.format ssh

git config --global user.signingkey ~/.ssh/id_ed25519.pub

git config --global commit.gpgsign true
```

This tells Git to:

- Use SSH instead of GPG for signing
- Sign commits by default

## Configure GPG Key

Either follow the steps to generate a new GPG key

<details>
<summary>Generate a new GPG key</summary>

```shell
gpg --full-generate-key
```

When prompted,

- Select the `ECC (sign and encrypt) *default*` option
- Select the `Curve 25519 *default*` option
- Select how long the key should be valid
- Your real name
- Your email address (must match the GitHub email)
- Passphrase (highly recommended for security)

to configure the key.

</details>

or follow the steps to use an existing one.

<details>
<summary>Use an existing GPG key</summary>

List existing GPG keys:

```shell
gpg --list-secret-keys --keyid-format LONG
```

Identify the key ID of the key you want to use (the part after `sec rsa4096/`).

Run the following command to export the public key (replace `<KEY_ID>` with your actual key ID):

```shell
gpg --armor --export <KEY_ID>
```

</details>

### Add the GPG Public Key to GitHub

Copy the contents of the _public key_ file:

```shell
gpg --list-secret-keys --keyid-format LONG

gpg --armor --export <KEY_ID>
```

In GitHub, go to [Settings](https://github.com/settings/profile) / [SSH and GPG keys](https://github.com/settings/keys) / [New GPG key](https://github.com/settings/gpg/new).

Give it a name (for example: `My Laptop`) and paste the key.

Click `Add GPG key`.

### Configure Git to Use GPG Signing

Run the following commands to enable commit signing globally:

```shell
git config --global gpg.format openpgp

git config --global user.signingkey <your_email@example.com>

git config --global commit.gpgsign true
```

This tells Git to:

- Use GPG for signing
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
git commit -m "Test signed commit"
git push
```

On GitHub, open the commit in the web UI, you should see "_Verified_".

![Verified commit](https://github.com/user-attachments/assets/753cbca6-6954-4b71-b60a-8a6433454d4f)

## Troubleshooting

If you see "_Unverified_" instead of "_Verified_":

- Make sure to use the same email as your GitHub account when generating the key.
- Confirm that the key was added to GitHub under SSH and GPG keys.
- Ensure `git config user.email` matches your GitHub email.
  To check your git config, run:

  ```shell
  git config user.email
  ```

- Verify that commits are being signed:

  ```shell
  git log --show-signature -1
  ```

## References

- [GitHub Docs: About commit signature verification](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification)
- [GitHub Docs: Signing commits](https://docs.github.com/en/authentication/managing-commit-signature-verification/signing-commits)
- [Git Docs: Commit signing](https://git-scm.com/book/en/v2/Git-Tools-Signing-Your-Work)
