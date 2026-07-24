Admin Survey Combined Upload Package

This is one survey package with two Space Types:
- Admin Office
- Counseling Suite

The files can be uploaded together as one Admin Survey configuration. Questions remain
separated by SpaceTypeID, so the application can display and assign each question set
independently while maintaining one shared survey.

SCORING
- MultiSelect items ending in 'i' or without a numeric score are Inventory.
- Repeated non-inventory ScoreIDs within the same MultiSelect question are Composite.
- Unique scored MultiSelect items are SingleResponse.
- YesNo and SingleSelect options remain standard SingleResponse options.
- Does not apply and Unable to assess are excluded from scoring.
- All initial Category, Subcategory, and Question weights are 1.
