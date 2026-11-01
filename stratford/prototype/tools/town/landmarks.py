"""Landmark definitions: where each one is found in OSM, and a short plain-history blurb.

Blurbs only state facts read on Wikipedia / the Doors Open Ontario, Ontario Heritage
Trust and City of Stratford pages (see reference/data/README.md); they are kept modest.
`find`: ('way', id) | ('node-building', id) building containing/nearest to that node |
        ('node', id) | ('river', near-landmark-id) | ('lake', node-id) | ('area', way-id)
"""
LANDMARKS = [
 dict(id='city-hall', name='Stratford City Hall', find=('way', '164420370'), radius=30, use='civic', material='brick_red',
      blurb="Built from 1898 and opened in January 1900, City Hall holds the council offices and an 800-seat auditorium. It was designated a National Historic Site of Canada in 1976."),
 dict(id='courthouse', name='Perth County Courthouse', find=('way', '68829362'), radius=30, use='civic',
      blurb="The county's second courthouse opened in 1887 and is noted for its High Victorian architecture. It was designed by George F. Durand, who also designed the neighbouring jail."),
 dict(id='market-square', name='Market Square', find=('area', '504649968'), radius=35,
      blurb="This square behind City Hall was set aside in 1834 and held the first town hall, a market house, from 1857. Farmers sold their produce here for many years, which is how Market Place got its name."),
 dict(id='avon-theatre', name='Avon Theatre', find=('node-building', '1753230306'), radius=25, use='theatre',
      blurb="Opened in January 1901 as the Theatre Albert, a cinema and vaudeville house. The Stratford Festival bought it in 1963 and reopened it, renovated, in 1967."),
 dict(id='festival-theatre', name='Festival Theatre', find=('way', '68829586'), radius=40, use='theatre', material='stone',
      blurb="Dedicated on June 30, 1957, it replaced the canvas tent where the Festival played its first four seasons from 1953. Its thrust stage seats over 1,800 on the bank of the Avon."),
 dict(id='tom-patterson-theatre', name='Tom Patterson Theatre', find=('node-building', '10013742810'), radius=30, use='theatre', material='glass',
      blurb="Named for the Stratford journalist Tom Patterson, who founded the Festival. The present building, designed by Siamak Hariri, opened in May 2022 beside the Avon River on the site of the earlier theatre."),
 dict(id='studio-theatre', name='Studio Theatre', find=('node-building', '1753265386'), radius=22, use='theatre',
      blurb="One of the Stratford Festival's four permanent theatres, a smaller house on George Street used for more intimate productions."),
 dict(id='avon-river', name='Avon River', find=('river', 'festival-theatre'), radius=45,
      blurb="Stratford was founded on its banks in 1832 and named the river for England's Avon; it was first called the Little Thames River. The 37 km river flows on to the North Thames."),
 dict(id='lake-victoria', name='Lake Victoria', find=('lake', '479846117'), radius=90,
      blurb="A seasonal reservoir on the Avon River, held back by the Thomas Orr Dam, at the heart of the park land beside the theatres."),
 dict(id='tom-patterson-island', name='Tom Patterson Island', find=('area', '39972896'), radius=45,
      blurb="A small island in the Avon River just below the Festival Theatre. The City of Stratford dedicated it to the Festival's founder in 1978."),
 dict(id='shakespearean-gardens', name='Shakespearean Gardens', find=('area', '345583466'), radius=40,
      blurb="Created in 1936, mainly through the efforts of R. Thomas Orr, beside the Avon River."),
 dict(id='normal-school', name='Stratford Normal School', find=('way', '247035619'), radius=35, use='civic',
      blurb="Opened in 1908 to train teachers, it became Stratford Teachers' College in 1953 and closed in 1973, after training nearly 14,000 teachers."),
 dict(id='knox-church', name='Knox Presbyterian Church', find=('way', '257380807'), radius=30, use='church', material='stone',
      blurb="The Knox congregation was organized in 1848. Its Ontario Street church was sold in 2022 and is now the Copperlight concert venue, while the congregation still worships there."),
 dict(id='st-james-church', name="St. James' Anglican Church", find=('way', '68829343'), radius=30, use='church', material='brick_buff',
      blurb="A buff brick Gothic Revival church by the architects Gundry and Langley, built about 1868 to 1870. It is the third church on its site."),
 dict(id='railway-station', name='Stratford Railway Station', find=('way', '302407042'), radius=40, use='civic',
      blurb="Railways reached Stratford in 1856 and made it a major junction. The former Canadian National station was designated a Federal Heritage Building in 1993."),
 dict(id='gallery-stratford', name='Gallery Stratford', find=('way', '255396302'), radius=25, use='civic',
      blurb="Founded in 1967, the gallery is housed in the former Stratford Pump House, the historic waterworks, designed by George F. Durand."),
 dict(id='archives', name='Former Registry Office (Stratford-Perth Archives)', find=('way', '305462315'), radius=25, use='civic',
      blurb="Opened in 1910 as the Perth County Registry Office and designed to harmonize with the courthouse and jail. The Stratford-Perth Archives were kept here from 1981 until 2015."),
 dict(id='public-library', name='Stratford Public Library', find=('node-building', '1798453590'), radius=25, use='civic',
      blurb="The library occupies a building of 1903 on St. Andrew Street, built with a $15,000 gift from Andrew Carnegie."),
]
