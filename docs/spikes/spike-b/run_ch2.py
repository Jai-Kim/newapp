#!/usr/bin/env python3
"""Spike B — chapter 2. Run as a SEPARATE process from run_ch1.py.

The experimental control: neither `lesson` nor `situation` mentions the lantern,
Sori, owls, or anything else from chapter 1. The only path by which chapter 2
can know about them is the canon generate-chapter retrieves from Postgres.
"""
from spike_b import generate

generate(
    "chapter-2",
    lesson="some things take time, and waiting is its own kind of patience",
    situation="A quiet evening at home after supper.",
)
