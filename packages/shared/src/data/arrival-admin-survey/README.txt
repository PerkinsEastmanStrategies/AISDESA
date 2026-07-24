Combined Arrival/Main Entry and Administration Survey Configuration

This is one upload package containing two surveys and three Space Types.

SURVEY: Arrival and Main Entry
- Main Office
- Community Partner Suite

SURVEY: Administration
- Professional Learning Center (PLC)

The records are combined into one set of six CSV files. SurveyID and SpaceTypeID keep
the content separated inside the shared import package.

SCORING CATEGORY ROUTING
- Main Office -> SCAT-AMO
- Community Partner Suite -> SCAT-AMO
- Professional Learning Center -> SCAT-ADM

SCORING RULES
- MultiSelect items with SourceScoreID ending in "i" are Inventory.
- Unique scored MultiSelect items are SingleResponse.
- Repeated non-inventory ScoreIDs within one MultiSelect question are Composite.
- YesNo and scored SingleSelect questions are SingleResponse.
- SingleSelect inventory questions are Inventory.
- Does not apply and Unable to assess are excluded from scoring.
- Initial Category, Subcategory, and Question weights are all 1.

FILES
01_Surveys.csv
02_SpaceTypes.csv
03_Categories.csv
04_Subcategories.csv
05_Questions.csv
06_QuestionOptions.csv
