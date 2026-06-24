# ERD — Recipe catalog

```mermaid
erDiagram
  categories ||--o{ recipes : categorizes
  recipes ||--o{ recipe_ingredients : contains
  ingredients ||--o{ recipe_ingredients : used_in
  recipes ||--o{ recipe_steps : has
  recipe_steps ||--o{ recipe_step_terms : mentions
  cooking_terms ||--o{ recipe_step_terms : explains
  app_users ||--o{ cooking_sessions : starts
  recipes ||--o{ cooking_sessions : cooked_as

  categories {
    uuid id PK
    varchar slug UK
    varchar name UK
    smallint display_order
  }

  recipes {
    uuid id PK
    varchar slug UK
    varchar title
    text description
    text image_url
    recipe_difficulty difficulty
    integer cook_time_minutes
    integer base_servings
    uuid category_id FK
    recipe_status status
    recipe_source source
    moderation_status moderation_status
  }

  ingredients {
    uuid id PK
    varchar name
    varchar normalized_name UK
    text_array aliases
  }

  recipe_ingredients {
    uuid recipe_id PK,FK
    uuid ingredient_id PK,FK
    numeric amount
    varchar unit
    text prep_note
    smallint display_order
  }

  recipe_steps {
    uuid id PK
    uuid recipe_id FK
    smallint display_order
    text content
    integer estimated_minutes
    varchar technique_icon
    boolean is_tricky
    integer timer_seconds
  }

  cooking_terms {
    uuid id PK
    varchar term UK
    text definition
  }

  app_users {
    uuid id PK
    varchar email
    varchar normalized_email UK
    user_role role
    user_status status
  }

  cooking_sessions {
    uuid id PK
    uuid user_id FK
    uuid recipe_id FK
    integer current_step
    integer servings
    timestamptz started_at
    timestamptz completed_at
    cooking_session_status status
  }
```
