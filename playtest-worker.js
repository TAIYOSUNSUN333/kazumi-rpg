---
layout: null
permalink: /service-worker.js
---
{%- capture worker -%}{% include_relative service-worker.js %}{%- endcapture -%}
{%- assign revision = site.github.build_revision | default: site.time | truncate: 8, '' -%}
{%- capture cache_name -%}'{{ revision }}'{%- endcapture -%}
{%- capture script_suffix -%}.js?v={{ revision }}',{%- endcapture -%}
{%- capture style_suffix -%}game.css?v={{ revision }}'{%- endcapture -%}
{{- worker | replace: "'action-14'", cache_name | replace: ".js',", script_suffix | replace: "game.css'", style_suffix -}}
