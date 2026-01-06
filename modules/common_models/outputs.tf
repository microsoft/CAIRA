# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

output "gpt_5" {
  value = {
    format  = "OpenAI"
    name    = "gpt-5"
    version = "2025-08-07"
  }
  description = "GPT-5 model - Reasoning model with advanced capabilities"
}

output "gpt_5_mini" {
  value = {
    format  = "OpenAI"
    name    = "gpt-5-mini"
    version = "2025-08-07"
  }
  description = "GPT-5-mini model - Balanced performance and cost efficiency"
}

output "gpt_5_nano" {
  value = {
    format  = "OpenAI"
    name    = "gpt-5-nano"
    version = "2025-08-07"
  }
  description = "GPT-5-nano model - Lightweight model for high-throughput scenarios"
}

output "gpt_5_chat" {
  value = {
    format  = "OpenAI"
    name    = "gpt-5-chat"
    version = "2025-10-03"
  }
  description = "GPT-5-chat model - Optimized for conversational AI with emotional intelligence"
}

output "gpt_5_1" {
  value = {
    format  = "OpenAI"
    name    = "gpt-5.1"
    version = "2025-11-13"
  }
  description = "GPT-5.1 model - Enhanced reasoning with configurable reasoning_effort"
}

output "gpt_5_1_chat" {
  value = {
    format  = "OpenAI"
    name    = "gpt-5.1-chat"
    version = "2025-11-13"
  }
  description = "GPT-5.1-chat model - Built-in reasoning capabilities for chat"
}

output "gpt_5_1_codex" {
  value = {
    format  = "OpenAI"
    name    = "gpt-5.1-codex"
    version = "2025-11-13"
  }
  description = "GPT-5.1-codex model - Optimized for Codex CLI and VS Code extension"
}

output "gpt_5_1_codex_mini" {
  value = {
    format  = "OpenAI"
    name    = "gpt-5.1-codex-mini"
    version = "2025-11-13"
  }
  description = "GPT-5.1-codex-mini model - Lightweight codex model"
}

output "gpt_5_2" {
  value = {
    format  = "OpenAI"
    name    = "gpt-5.2"
    version = "2025-12-11"
  }
  description = "GPT-5.2 model - Reasoning model"
}

output "gpt_5_2_chat" {
  value = {
    format  = "OpenAI"
    name    = "gpt-5.2-chat"
    version = "2025-12-11"
  }
  description = "GPT-5.2-chat model - Chat model with advanced capabilities"
}

output "text_embedding_3_small" {
  value = {
    format  = "OpenAI"
    name    = "text-embedding-3-small"
    version = "1"
  }
  description = "Text embedding 3 small model"
}

output "text_embedding_3_large" {
  value = {
    format  = "OpenAI"
    name    = "text-embedding-3-large"
    version = "1"
  }
  description = "Text embedding 3 large model - Most capable embedding model"
}

output "gpt_realtime" {
  value = {
    format  = "OpenAI"
    name    = "gpt-realtime"
    version = "2025-08-28"
  }
  description = "GPT-realtime model (GA) - Real-time audio processing"
}

output "gpt_realtime_mini" {
  value = {
    format  = "OpenAI"
    name    = "gpt-realtime-mini"
    version = "2025-10-06"
  }
  description = "GPT-realtime-mini model - Lightweight real-time audio processing"
}

output "gpt_audio" {
  value = {
    format  = "OpenAI"
    name    = "gpt-audio"
    version = "2025-08-28"
  }
  description = "GPT-audio model (GA) - Audio generation capabilities"
}

output "gpt_audio_mini" {
  value = {
    format  = "OpenAI"
    name    = "gpt-audio-mini"
    version = "2025-10-06"
  }
  description = "GPT-audio-mini model - Lightweight audio generation"
}

output "gpt_4o_mini_transcribe" {
  value = {
    format  = "OpenAI"
    name    = "gpt-4o-mini-transcribe"
    version = "2025-12-15"
  }
  description = "GPT-4o-mini-transcribe model - Improved transcription accuracy and robustness"
}

output "gpt_4o_transcribe_diarize" {
  value = {
    format  = "OpenAI"
    name    = "gpt-4o-transcribe-diarize"
    version = "1"
  }
  description = "GPT-4o-transcribe-diarize model - Speech-to-text with speaker diarization"
}
