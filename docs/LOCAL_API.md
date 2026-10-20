# Umber local API

Generate images and videos using the provider connections already configured in the Umber desktop app. Requests use the same generation engine, gallery and usage history as the app.

## Connect

Enable **Local API** in Settings and use **Copy for agent**. The base URL is `http://127.0.0.1:19432`. No authentication key or Authorization header is required. Enabling the API allows local programs to use Umber's connected providers.

Keep Umber running. On macOS, closing its window while the API is enabled keeps that window available in the background. On Windows and Linux, closing the last window quits Umber. Quitting Umber stops the API. The enabled setting survives restarts. Turning the API off stops new requests immediately. An accepted generation continues and saves its results; turn the API back on to retrieve its job.

The server listens only on IPv4 loopback. Use a local terminal, script or agent process. A cloud agent needs a tool that executes on this computer. Browser-origin requests and non-loopback Host headers are rejected. There is no CORS access, remote listening mode or separate background service.

`GET /llms.txt` and `GET /` return this guide as plain text. Provider credentials stay in Umber. Erase all data disables the API, clears retained jobs and resets access, limits and recorded spend. Erasing is blocked while an API generation is running.

## Access and spending limits

Settings choose what local programs may generate: images, videos or both. A kind that is turned off returns 403 `feature_disabled` on all its routes, and its models disappear from `GET /v1/models`. Only images are allowed until you change it.

Settings can also hold spending limits. Each limit is an amount in USD over a rolling window of 1, 7 or 30 days, or over all time. "$2 every 7 days" means API spend in the last 7 days, not a calendar week. Umber checks every limit before calling a provider. It counts the estimate of the new request, plus finished API generations and generations still running. A request that would pass any limit fails with 402 `spending_limit`. While any limit exists, a request without a cost estimate fails with 402 `cost_unknown`. Limits count Umber's catalog estimates, not provider bills, and only API requests count. Both estimate endpoints report `limits`, each with `usd`, `days` (`null` for all time), `spent` and `remaining`.

## Tell an agent where to start

An agent needs the documentation URL to discover the API. Give it this instruction once, or add it to the agent's project instructions:

> Use Umber to generate images and videos on this computer. Read http://127.0.0.1:19432/llms.txt first for endpoints, arguments and examples.

The guide defines the endpoints and request fields. `GET /v1/models` supplies the current model IDs, supported argument values and defaults directly from Umber's catalog. Agents should read both before generating. Image and video routes work the same way; replace `images` with `videos` in each path.

## Recommended agent workflow

1. Read `GET /llms.txt`.
2. Call `GET /v1/models`. Choose an entry with `connected: true` and the `kind` you need. Use its exact model ID and supported controls. Do not guess model IDs.
3. Call `POST /v1/images/estimate` or `POST /v1/videos/estimate` with the intended request. This validates settings and returns the app's cost estimate and remaining limits without contacting a provider.
4. Call the matching `generations` endpoint with the same JSON and a new `Idempotency-Key` header. This returns HTTP 202 with a job ID and relative `pollUrl`. An invalid request or a passed limit is answered right away instead, and no job is created.
5. Poll that URL every two seconds until `status` is `succeeded` or `failed`. A poll is always read-only. Never submit a new generation just because a poll timed out.
6. For success, read `result`, check `failures` and `persisted`, then download each `result.outputs[].downloadUrl`. Resolve relative URLs against the base URL.
7. Retain creation IDs to fetch metadata and files again after restarting Umber. Retain the returned result if you need the complete request summary later.

One image generation and one video generation can run at the same time. Another submission of a kind that is already running receives HTTP 429. The app's own composer can still generate independently. An image request can ask for up to four images, subject to the model's limit. A video request makes one clip and takes minutes; keep polling.

## Endpoints

| Method | Path                        | Result                                                       |
| ------ | --------------------------- | ------------------------------------------------------------ |
| GET    | `/llms.txt`                 | This guide, plain text                                       |
| GET    | `/v1/models`                | Allowed models, connection state, capabilities and defaults  |
| POST   | `/v1/images/estimate`       | Validated settings, USD estimates and limits, no paid call   |
| POST   | `/v1/images/generations`    | HTTP 202, asynchronous job                                   |
| GET    | `/v1/images/{imageId}`      | Saved image metadata, including estimated cost               |
| GET    | `/v1/images/{imageId}/file` | Original image bytes with their media type                   |
| POST   | `/v1/videos/estimate`       | Validated settings, USD estimates and limits, no paid call   |
| POST   | `/v1/videos/generations`    | HTTP 202, asynchronous job                                   |
| GET    | `/v1/videos/{videoId}`      | Saved clip metadata, including estimated cost                |
| GET    | `/v1/videos/{videoId}/file` | Original clip bytes with their media type                    |
| GET    | `/v1/generations/{jobId}`   | Job status and complete result once finished, for both kinds |

Requests with JSON bodies require `Content-Type: application/json`. The body limit is 24 MiB including base64. Only the documented request fields are accepted. Unknown fields fail validation, so image controls on a video request fail and the reverse.

## Image request

Both POST endpoints accept the same JSON:

```json
{
    "model": "COPY_AN_ID_FROM_GET_V1_MODELS",
    "prompt": "A small blue ceramic vase on a warm white background",
    "count": 1
}
```

| Field         | Type    | Rule                                                                                    |
| ------------- | ------- | --------------------------------------------------------------------------------------- |
| `model`       | string  | Required image model ID from `/v1/models`                                               |
| `prompt`      | string  | Required, nonblank, at most 32,000 characters                                           |
| `count`       | integer | Optional, defaults to 1, maximum 4 or the model's lower limit                           |
| `aspectRatio` | string  | Optional, a listed ratio such as `1:1`, or `first-image` with a reference               |
| `resolution`  | string  | Optional, a listed resolution such as `1K`                                              |
| `quality`     | string  | Optional, one of the model's `qualities`; omit if that list is empty                    |
| `references`  | array   | Optional, defaults to `[]`; respect the model's `references.max` and `references.types` |

Omitted controls use the defaults returned by `/v1/models`. Unsupported values are rejected, never silently substituted. `first-image` preserves the first reference's ratio using the same compatibility rules as Umber's composer.

Each reference is `{ "name": "reference.png", "mediaType": "image/png", "base64": "..." }`. `name` is optional. Use standard padded base64 without a data URL prefix. PNG, JPEG and WebP are accepted only when the selected model supports them. Each decoded file is limited to 10 MiB. URLs and local file paths are not accepted. Encode the file yourself. References allow image editing through supported models; they do not overwrite a gallery image.

`GET /v1/models` returns `{ "data": [...] }`, image models first. Each image entry includes `id`, `name`, `providerId`, `kind`, `connected`, `aspectRatios`, `resolutions`, `qualities`, `maxOutputs`, `references` and `defaults`. `connected` means a key is stored, not that the provider has approved access to every model.

## Video request

Both video POST endpoints accept the same JSON:

```json
{
    "model": "COPY_A_VIDEO_ID_FROM_GET_V1_MODELS",
    "prompt": "A small blue ceramic vase turning slowly on a warm white background",
    "durationSeconds": 5
}
```

| Field             | Type   | Rule                                                                         |
| ----------------- | ------ | ---------------------------------------------------------------------------- |
| `model`           | string | Required video model ID from `/v1/models`                                    |
| `prompt`          | string | Required, nonblank, at most 32,000 characters                                |
| `aspectRatio`     | string | Optional, a listed ratio such as `16:9`                                      |
| `resolution`      | string | Optional, a listed resolution such as `720p`                                 |
| `durationSeconds` | number | Optional, one of the model's `durations`; omit it when that list is empty    |
| `firstFrame`      | object | Optional still the clip starts from, in the reference format above           |
| `lastFrame`       | object | Optional still the clip ends on; needs `firstFrame` and `lastFrame: true`    |
| `references`      | array  | Optional, defaults to `[]`; respect the model's `references.max` and `types` |

Each video entry in `/v1/models` includes `id`, `name`, `providerId`, `kind`, `connected`, `aspectRatios`, `resolutions`, `durations`, `lastFrame`, `references` and `defaults`. An empty `durations` list means the model picks its own clip length and has no fixed price. Some providers accept frames or references but not both; such a request fails with 502 before anything is charged.

## Generate and retrieve

This shell example uses `curl` and `jq`. It chooses the first connected image model and uses that model's defaults.

```sh
export UMBER_URL=http://127.0.0.1:19432

model=$(curl --fail-with-body -sS "$UMBER_URL/v1/models" \
  | jq -r '[.data[] | select(.connected)][0].id // empty')
test -n "$model" || { echo 'Connect an image provider in Umber Settings first.'; exit 1; }

request=$(jq -n --arg model "$model" \
  '{model: $model, prompt: "A small blue ceramic vase on a warm white background", count: 1}')

curl --fail-with-body -sS "$UMBER_URL/v1/images/estimate" \
  -H 'Content-Type: application/json' -d "$request"

# Save this key before submitting. Reuse it only to recover this same submission.
key=$(uuidgen)
job=$(curl --fail-with-body -sS "$UMBER_URL/v1/images/generations" \
  -H "Idempotency-Key: $key" \
  -H 'Content-Type: application/json' -d "$request")
poll=$(printf '%s' "$job" | jq -r .pollUrl)

while true; do
  job=$(curl --fail-with-body -sS "$UMBER_URL$poll") || exit 1
  state=$(printf '%s' "$job" | jq -r .status)
  case "$state" in
    succeeded) break ;;
    failed) printf '%s\n' "$job"; exit 1 ;;
    running) sleep 2 ;;
    *) printf '%s\n' "$job"; exit 1 ;;
  esac
done
printf '%s\n' "$job" > generation.json

# For count > 1, download every output. Preserve generation.json for metadata.
file=$(printf '%s' "$job" | jq -r '.result.outputs[0].downloadUrl // empty')
if test -n "$file"; then
  curl --fail-with-body -sS "$UMBER_URL$file" -o generated-image
else
  echo 'Gallery storage failed. Recover each output from its base64 field in generation.json.'
fi
```

The POST response contains `id`, `status`, `createdAt` and `pollUrl`. Timestamps are Unix milliseconds. Polling adds `resultStatus` and `result` when the job settles. A failed job still returns HTTP 200 when polled; inspect its `status` and `result.error`. Validation failures surface there too.

The `Idempotency-Key` header is a request ID generated by the client, not an authentication credential. It is required for generation to prevent duplicate charges when retrying. It accepts 1 to 128 letters, digits, dots, dashes or underscores. Repeating a key with the same JSON returns the same job without another provider call. A changed body returns 409. Keep the JSON field order the same when retrying. Keys and jobs are retained for the latest 32 submissions in this app session, including while the API is toggled off. They do not survive app quit or a data reset. Reloading the renderer interrupts in-flight jobs. Do not blindly resubmit after a restart or an unknown renderer failure; inspect the gallery first because the provider may already have charged you.

## Complete generation result

A successful job's `result` contains all generation job fields and saved creation fields used by the app. Output Blob/object URLs are replaced with HTTP download URLs.

- `id`: Umber's generation ID, distinct from the API job ID.
- `status`: `done`.
- `kind`: `image` or `video`.
- `prompt`, `providerId`, `modelId`, `modelName`.
- `ratio`, `resolution`, `quality`, `count`, `durationSeconds`. `quality` is empty for models without tiers and `durationSeconds` is zero for images. `count` is how many outputs were requested. `durationSeconds` is the clip length for videos.
- `startedAt`: Unix milliseconds.
- `generationMs`: elapsed generation time, as reported by the app.
- `currency`: `USD`.
- `estimatedCost`: estimate per output, or `null` if unknown.
- `estimatedTotalCost`: per-output estimate multiplied by the number of outputs actually returned, or `null`.
- `requestedEstimatedCost`: original estimate for the requested count, or `null`.
- `actualCost`: always `null`. The existing app does not capture provider invoices or authoritative usage charges.
- `note`: explanation of estimate limits. Catalog estimates may exclude prompt and reference-image input charges. They are not a final bill. Partial failures may still incur provider charges.
- `persisted`: whether all outputs were saved to the gallery and usage history.
- `failures`: individual provider failures or a shortfall explanation. A partially successful run is `succeeded` with fewer outputs and a nonempty `failures` array. Never automatically rerun the whole request to fill a shortfall.
- `outputs`: one entry per generated image or clip.

Each output preserves every stored creation field: `id`, `kind`, `prompt`, `providerId`, `modelId`, `modelName`, `ratio`, `resolution`, `quality`, `generationMs`, `createdAt` and `estimatedCost`. Optional `parentId`, `rootId` and `version` are included when present. Video outputs also carry `durationSeconds`. Each output includes `mediaType`, `sizeBytes` and a relative `downloadUrl` under `/v1/images` or `/v1/videos`.

If gallery persistence fails, `persisted` is false, each `downloadUrl` is null and each output includes `base64` so the paid image can still be recovered. Save those bytes immediately. Job results are bounded to this session. Successful persisted outputs do not embed base64, keeping normal responses small.

`GET /v1/images/{imageId}` and `GET /v1/videos/{videoId}` return the same saved metadata and download information after generation, including after an app restart. Deleting a creation from the gallery makes its metadata and download endpoints return 404. Usage history follows Umber's normal retention rules. Each route only returns its own kind.

The estimate endpoints return `currency`, `estimatedCost`, `estimatedTotalCost`, `actualCost`, `note`, the resolved composer `settings` and `limits`. The internal `durationSeconds` setting has no effect on image generation. Estimates use the same catalog calculation as the Generate button and saved usage records.

## Errors

Errors use `{ "error": { "code": "...", "message": "..." } }`.

| Status | Meaning                                                                  |
| ------ | ------------------------------------------------------------------------ |
| 400    | Invalid JSON, fields, model, capabilities, references or idempotency key |
| 402    | `spending_limit` or `cost_unknown`; see access and spending limits       |
| 403    | Browser-origin request, incorrect Host or `feature_disabled`             |
| 404    | Unknown route, expired job or missing, deleted or other-kind creation    |
| 409    | Provider not connected or idempotency key reused for another body        |
| 413    | Request or reference too large                                           |
| 415    | JSON Content-Type missing                                                |
| 429    | Generation of this kind already running or too many concurrent requests  |
| 500    | Internal processing or storage read failure                              |
| 502    | Generation failed at the provider                                        |
| 503    | Umber renderer unavailable; check the gallery before retrying            |

A listener conflict appears in Settings instead of silently changing ports. Free port 19432, then turn the API off and on.
