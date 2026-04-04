# Encryption Service Audit

## Summary
The encryption contract is real, but it is distributed across multiple services rather than centralized.

## Missing Logic / Edge Cases
- No single encryption service owns password hashing, archive encryption, and secure handshake policy.
- Key rotation and centralized secret lifecycle management are not implemented.
- Some security expectations depend on drive state rather than cryptographic enforcement.

## Documentation-to-Code Mismatches
- The doc should describe encryption as a cross-cutting contract, not a standalone runtime subsystem.
- Local auth hashing and vault archive encryption are separate mechanisms.
- The system has mount-related security behavior, but no unified "encryption service" module yet.

## Security Risks
- Fragmented encryption logic can lead to inconsistent policy enforcement.
- Password and archive settings are only as safe as the runtime bootstrap configuration that seeds them.

## Recommended Fixes
- Introduce a dedicated service boundary or clearly label this as a cross-cutting contract.
- Add a key-rotation and credential lifecycle roadmap.
- Add tests verifying that sensitive auth artifacts never enter vault payloads.
