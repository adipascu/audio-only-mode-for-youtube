# Setting up automated publishing

Everything here is one-time and needs a browser signed in as the developer
account, so none of it can be scripted from CI. Once it is done, merging a
version bump to `main` publishes on its own.

This targets the Chrome Web Store API V2. V1 is deprecated and stops working on
15 October 2026.

## 1. Register as a developer

Open https://chrome.google.com/webstore/devconsole and pay the one-time 5 USD
registration fee. The account that pays owns the listing.

Take your **publisher id** from Publisher, then Settings. It goes in the API URL
alongside the item id.

## 2. Create the item by hand

V2 cannot create items at all, and even V1 could not fill in listing metadata.
Publishing fails until the Store listing and Privacy tabs are complete, so the
first upload is a manual one.

```sh
npm run build
```

Upload `dist/chrome.zip` as a new item, fill in every field from
`store/listing.md`, and save. Screenshots have to come from a browser with the
extension loaded, see the end of that file.

The **item id** is the 32-letter string in the dashboard URL,
`.../devconsole/campaign/items/<ITEM_ID>/edit`.

## 3. Create a service account

A service account avoids the OAuth refresh-token dance entirely, and its
credentials do not expire. At https://console.cloud.google.com:

1. Create a project, any name.
2. APIs and Services, Library, enable **Chrome Web Store API**.
3. IAM and Admin, Service Accounts, create one. It needs no project roles.
4. On that service account, Keys, Add key, Create new key, **JSON**. The file
   downloads once and cannot be downloaded again.

Then back in the developer dashboard, under **Account**, add the service account
email so it can act on your behalf. Only one service account is allowed per
publisher.

## 4. Hand the credentials to CI

The key is a JSON file, so pass the whole file as the secret value:

```sh
gh secret set CHROME_SERVICE_ACCOUNT_KEY --repo adipascu/audio-only-mode-for-youtube < service-account.json
gh secret set CHROME_PUBLISHER_ID --repo adipascu/audio-only-mode-for-youtube
gh secret set CHROME_EXTENSION_ID --repo adipascu/audio-only-mode-for-youtube
```

Delete the downloaded JSON key afterwards. It is the whole credential.

## How releasing works after that

`.github/workflows/publish.yml` runs on every push to `main` and compares the
`version` in `package.json` against the commit the push started from. When it is
unchanged the job does nothing, because the store rejects a package whose version
it already holds. When it moved, the workflow tests, builds, uploads and
publishes.

So a release is a version bump:

```sh
npm version patch --no-git-tag-version
```

Commit that on a branch, merge it, and the pipeline does the rest.

Publishing queues a review, so a green job means accepted for review rather than
live. The script treats `PENDING_REVIEW` as success and prints the state it got.

If a publish fails for a transient reason, run the workflow by hand from the
Actions tab. A manual run skips the version comparison and always publishes,
which is what you want for a retry.

The Firefox package is attached to the run as an artifact. Nothing uploads it to
addons.mozilla.org yet.
