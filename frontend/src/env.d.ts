/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    device: 'all' | 'steam_deck' | 'rog_ally' | 'legion_go';
  }
}