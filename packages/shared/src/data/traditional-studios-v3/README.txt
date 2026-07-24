Traditional Studios Survey Configuration v3

CHANGE FROM V2
The generic Weights.csv file has been removed. Category and Subcategory weights now live
directly on the objects they describe:

- CategoryWeight is stored in 03_Categories.csv
- SubcategoryWeight is stored in 04_Subcategories.csv
- QuestionWeight remains in 05_Questions.csv
- ItemWeight remains in 06_QuestionOptions.csv only for field-item scoring behavior

FILES
01_Survey.csv
02_SpaceTypes.csv
03_Categories.csv
04_Subcategories.csv
05_Questions.csv
06_QuestionOptions.csv

KEY RELATIONSHIPS
Survey 1 -> many SpaceTypes
Survey/SpaceType 1 -> many Categories
Category 1 -> many Subcategories
Subcategory 1 -> many Questions
Question 1 -> many QuestionOptions / Field Items

MULTI-SELECT
ItemScoringMode is assigned to each row in QuestionOptions:
Inventory, Composite, or SingleResponse.

This folder contains Traditional Studio + Sensory Lab + Vocational Lab + Life Skills Room + Sped Flex Studio packages (shared Questions/Options tables).

Traditional + Sensory + Vocational + Life Skills + Sped Flex share Questions/Options (05_Questions.csv, 06_QuestionOptions.csv).
