Neighborhood Survey Combined Upload Package

This package contains one survey and three Space Types:
- Neighborhood
- Group Room
- Open Collaboration Space

All records use SurveyID SRV-NEIGHBORHOOD and ScoringCategoryID SCAT-NBH.
SpaceTypeID keeps each question set independently assignable and renderable.

SCORING RULES
- MultiSelect items with SourceScoreID ending in "i" are Inventory.
- Unique scored MultiSelect items are SingleResponse.
- Repeated non-inventory ScoreIDs within one MultiSelect question are Composite.
- YesNo and scored SingleSelect options are SingleResponse.
- Does not apply and Unable to assess are excluded from scoring.
- Initial Category, Subcategory, and Question weights are all 1.

FILES
01_Surveys.csv
02_SpaceTypes.csv
03_Categories.csv
04_Subcategories.csv
05_Questions.csv
06_QuestionOptions.csv
