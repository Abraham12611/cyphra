module access_policies::campaign_policies {

    use std::string::String;

    /// Simple access policy record for a campaign.
    public struct AccessPolicy has copy, drop {
        campaign_id: String,
        rule: String,
    }

    /// Create a new policy value.
    public fun new_policy(
        campaign_id: String,
        rule: String,
    ): AccessPolicy {
        AccessPolicy { campaign_id, rule }
    }

    /// Placeholder check: currently always allows access.
    /// Extend this later with real logic (roles, ownership, etc.).
    public fun can_access(
        _policy: &AccessPolicy,
        _user: address,
    ): bool {
        true
    }
}
