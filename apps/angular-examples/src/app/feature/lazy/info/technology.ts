export class Technology {
  constructor(
    public title: string,
    public link: string,
    public image: string,
    /** a variant of the logo for the dark theme, when the logo is too dark for it */
    public darkImage?: string
  ) {}
}
