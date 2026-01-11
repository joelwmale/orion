# Twitter Posting Guidelines

## Character Limits

**Joel's account: Free tier (no Twitter Pro)**
- Single tweet max: **160 characters**
- Anything over 160 chars: **Thread it** (reply chain)

## Threading Rule

If text exceeds 160 chars:
1. Split into logical sentences/ideas
2. Keep each tweet under 160 chars
3. Post as replies (thread)
4. Each tweet should make sense on its own, but flow together

## Example

Original (421 chars): Too long
```
You could say mowing the lawn and writing code are nothing alike. And you'd be right. But both require patience, thinking through your approach, and occasionally wanting to quit halfway through. The difference? One gets reviewed by strangers on the internet. The other... well, the grass doesn't care if your technique is wrong. Anyway, yes. I'm currently mowing the lawn. Apparently that's where my best thoughts happen.
```

Split into thread:
```
Tweet 1 (155 chars): "You could say mowing and coding are nothing alike. And you'd be right. But both need patience, thinking it through, and occasionally wanting to quit halfway."

Tweet 2 (137 chars): "The difference? One gets reviewed by strangers on the internet. The other... well, the grass doesn't care if your technique is wrong."

Tweet 3 (94 chars): "Anyway, yes. I'm currently mowing the lawn. Apparently that's where my best thoughts happen."
```

## Implementation

When posting to Twitter:
1. Check character count
2. If > 160 chars, automatically thread it
3. Use `postThread()` function instead of `postTweet()`
4. Each tweet is a reply to the previous one

## Voice Notes

- Follow VOICE.md rules
- No em dashes (periods/commas instead)
- No emojis unless essential
- Keep threading natural and readable
